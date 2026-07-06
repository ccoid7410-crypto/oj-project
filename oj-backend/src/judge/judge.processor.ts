import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { DockerSandboxService } from './sandbox/docker-sandbox.service';
import { JudgeConfigService } from '../judge-config/judge-config.service';
import { RatingService } from '../rating/rating.service';
import { JUDGE_QUEUE, JudgeJobData } from './judge.constants';
import { JudgeStatus, outputsMatch, worseStatus } from './judge-status.util';

export const SUBMISSION_UPDATES_CHANNEL = 'submission-updates';

function shQuote(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

@Processor(JUDGE_QUEUE, { concurrency: 2 })
export class JudgeProcessor extends WorkerHost {
  private readonly logger = new Logger(JudgeProcessor.name);
  private readonly publisher: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sandbox: DockerSandboxService,
    private readonly judgeConfig: JudgeConfigService,
    private readonly rating: RatingService,
    private readonly config: ConfigService,
  ) {
    super();
    this.publisher = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
    });
  }

  async process(job: Job<JudgeJobData>): Promise<void> {
    const { submissionId } = job.data;
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { problem: true },
    });
    if (!submission) {
      this.logger.error(`제출을 찾을 수 없음: ${submissionId}`);
      return;
    }

    await this.updateStatus(submissionId, 'JUDGING');

    // judge-worker는 docker.sock으로 "형제" 컨테이너(채점용)를 띄우는 구조(Docker-outside-of-Docker)라서,
    // 바인드 마운트의 소스 경로는 이 워커 컨테이너 내부 경로가 아니라 "도커 데몬이 이해하는 호스트 경로"여야 한다.
    // 그래서 워커 컨테이너와 호스트가 같은 디렉토리를 공유하도록 볼륨을 고정해두고(JUDGE_TMP_DIR ↔ HOST_JUDGE_TMP_DIR),
    // 파일은 컨테이너 경로(JUDGE_TMP_DIR)에 쓰되, 형제 컨테이너에 넘길 바인드 소스는 호스트 경로(HOST_JUDGE_TMP_DIR)로 계산한다.
    const tmpBase = this.config.get<string>('JUDGE_TMP_DIR', os.tmpdir());
    const hostTmpBase = this.config.get<string>('HOST_JUDGE_TMP_DIR', tmpBase);
    const boxDir = await fs.mkdtemp(path.join(tmpBase, `judge-${submissionId}-`));
    // hostTmpBase는 Windows 경로(백슬래시)일 수 있어 POSIX path.join을 쓰면 구분자를 못 알아채므로 직접 결합한다.
    const hostSep = hostTmpBase.includes('\\') ? '\\' : '/';
    const hostBoxDir = `${hostTmpBase.replace(/[\\/]+$/, '')}${hostSep}${path.basename(boxDir)}`;
    try {
      const runnerConfig = await this.judgeConfig.getRunnerConfig(submission.language);
      await fs.writeFile(path.join(boxDir, runnerConfig.fileName), submission.sourceCode, 'utf-8');
      await fs.chmod(boxDir, 0o777); // 컨테이너 내부 유저가 쓸 수 있도록. TODO: non-root 유저 고정 후 권한 최소화

      // 1) 컴파일 단계 (필요한 언어만)
      if (runnerConfig.compileCmd) {
        const compileResult = await this.sandbox.run({
          image: runnerConfig.compileImage!,
          cmd: runnerConfig.compileCmd,
          binds: [`${hostBoxDir}:/box`],
          timeoutMs: 10_000,
          memoryLimitMb: 512,
        });
        if (compileResult.timedOut || compileResult.exitCode !== 0) {
          await this.finalize(submissionId, 'COMPILE_ERROR', {
            errorMessage: compileResult.stderr.slice(0, 4000) || '컴파일 실패',
          });
          return;
        }
      }

      // 2) 테스트케이스 실행
      const testCases = await this.prisma.testCase.findMany({
        where: { problemId: submission.problemId },
        orderBy: { order: 'asc' },
      });

      let finalStatus: JudgeStatus = 'ACCEPTED';
      let maxRuntimeMs = 0;

      for (const tc of testCases) {
        // stdin은 도커 attach 소켓으로 스트리밍하지 않고 파일로 써서 셸 리다이렉션으로 넘긴다.
        // (Windows의 named pipe 기반 도커 데몬에서는 attach stdin 하이재킹이 안정적으로 동작하지 않음)
        await fs.writeFile(path.join(boxDir, 'input.txt'), tc.input, 'utf-8');
        const result = await this.sandbox.run({
          image: runnerConfig.runImage,
          cmd: ['/bin/sh', '-c', `${runnerConfig.runCmd.map(shQuote).join(' ')} < /box/input.txt`],
          binds: [`${hostBoxDir}:/box`],
          timeoutMs: submission.problem.timeLimitMs,
          memoryLimitMb: submission.problem.memoryLimitMb,
        });

        maxRuntimeMs = Math.max(maxRuntimeMs, result.runtimeMs);

        let status: JudgeStatus;
        if (result.timedOut) {
          status = 'TIME_LIMIT_EXCEEDED';
        } else if (result.exitCode !== 0) {
          status = 'RUNTIME_ERROR';
        } else if (!outputsMatch(tc.output, result.stdout)) {
          status = 'WRONG_ANSWER';
        } else {
          status = 'ACCEPTED';
        }

        await this.prisma.submissionTestResult.create({
          data: {
            submissionId,
            testCaseId: tc.id,
            status: status as any,
            runtimeMs: result.runtimeMs,
            output: result.stdout.slice(0, 2000),
          },
        });

        finalStatus = worseStatus(finalStatus, status);

        // 채점 관례: 첫 실패 테스트케이스에서 조기 종료
        if (status !== 'ACCEPTED') break;
      }

      await this.finalize(submissionId, finalStatus, { runtimeMs: maxRuntimeMs });

      if (finalStatus === 'ACCEPTED') {
        // 이 문제를 처음 통과한 경우에만 레이팅(상위 100문제 합)을 다시 계산한다.
        const firstAccept = await this.rating.isFirstAccept(submission.userId, submission.problemId);
        if (firstAccept) {
          await this.rating.recomputeForUser(submission.userId);
        }
      }
    } catch (err) {
      this.logger.error(`채점 중 예외 발생 (submission=${submissionId}): ${err}`);
      await this.finalize(submissionId, 'INTERNAL_ERROR', { errorMessage: String(err).slice(0, 2000) });
    } finally {
      await fs.rm(boxDir, { recursive: true, force: true });
    }
  }

  private async updateStatus(submissionId: string, status: 'JUDGING') {
    await this.prisma.submission.update({ where: { id: submissionId }, data: { status: status as any } });
    await this.publisher.publish(SUBMISSION_UPDATES_CHANNEL, JSON.stringify({ submissionId, status }));
  }

  private async finalize(
    submissionId: string,
    status: JudgeStatus,
    extra: { runtimeMs?: number; memoryKb?: number; errorMessage?: string } = {},
  ) {
    await this.prisma.submission.update({
      where: { id: submissionId },
      data: { status: status as any, judgedAt: new Date(), ...extra },
    });
    await this.publisher.publish(
      SUBMISSION_UPDATES_CHANNEL,
      JSON.stringify({ submissionId, status, ...extra }),
    );
  }
}
