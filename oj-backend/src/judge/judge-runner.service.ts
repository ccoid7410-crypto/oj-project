import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { DockerSandboxService } from './sandbox/docker-sandbox.service';
import { JudgeStatus, outputsMatch, worseStatus } from './judge-status.util';
import type {
  JudgeLease,
  JudgeResult,
  JudgeTestResult,
} from './judge-protocol';

function shQuote(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

const COMPILE_TIMEOUT_MS = 10_000;
const COMPILE_MEMORY_LIMIT_MB = 512;

function numericScore(
  mode: JudgeLease['scoringMode'],
  expected: string,
  actual: string,
): number | null {
  const target = Number(expected.trim().split(/\s+/)[0]);
  const value = Number(actual.trim().split(/\s+/)[0]);
  if (!Number.isFinite(target) || !Number.isFinite(value)) return null;

  if (mode === 'MAXIMIZE') {
    if (target === 0) return value >= 0 ? 1 : 0;
    return Math.max(0, Math.min(1, value / target));
  }
  if (mode === 'MINIMIZE') {
    if (value <= 0) return null;
    if (target === 0) return value === 0 ? 1 : 0;
    return Math.max(0, Math.min(1, target / value));
  }

  const scale = Math.max(Math.abs(target), 1e-9);
  return Math.max(0, Math.min(1, 1 - Math.abs(value - target) / scale));
}

/**
 * runImage/compileImage는 DB(judge_config)에서 관리자가 바꿀 수 있는 값이라,
 * 채점 VM 입장에서는 "신뢰 경계 바깥에서 온 문자열"이다. API나 인터체인저가 털렸을 때
 * 채점 VM이 임의의 레지스트리 이미지를 pull/run하는 걸 막기 위해 여기서 한 번 더 거른다.
 */
const DEFAULT_ALLOWED_IMAGE_PREFIXES = [
  'gcc:',
  'python:',
  'eclipse-temurin:',
  'node:',
  'golang:',
];

/**
 * 채점 실행기. **DB도 Redis도 건드리지 않는다.**
 *
 * 입력은 자족적인 JudgeLease 하나이고 출력은 JudgeResult 하나다. 이 클래스가 채점 VM에
 * 남는 유일한 도메인 로직이며, 격리의 핵심은 "여기서 밖으로 나가는 경로가 없다"는 점이다.
 */
@Injectable()
export class JudgeRunnerService {
  private readonly logger = new Logger(JudgeRunnerService.name);
  private readonly allowedImagePrefixes: string[];

  constructor(
    private readonly sandbox: DockerSandboxService,
    private readonly config: ConfigService,
  ) {
    const raw = this.config
      .get<string>('JUDGE_ALLOWED_IMAGE_PREFIXES', '')
      .trim();
    this.allowedImagePrefixes = raw
      ? raw
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
      : DEFAULT_ALLOWED_IMAGE_PREFIXES;
  }

  private assertImageAllowed(image: string): void {
    if (!this.allowedImagePrefixes.some((prefix) => image.startsWith(prefix))) {
      throw new Error(`허용되지 않은 채점 이미지입니다: ${image}`);
    }
  }

  async run(lease: JudgeLease): Promise<JudgeResult> {
    const { submissionId, leaseId, runnerConfig } = lease;

    // Docker-outside-of-Docker: 형제 컨테이너에 넘길 바인드 소스는 "도커 데몬이 이해하는 호스트 경로"라야 한다.
    // 그래서 파일은 컨테이너 경로(JUDGE_TMP_DIR)에 쓰되, 바인드 소스는 호스트 경로(HOST_JUDGE_TMP_DIR)로 계산한다.
    const tmpBase = this.config.get<string>('JUDGE_TMP_DIR', os.tmpdir());
    const hostTmpBase = this.config.get<string>('HOST_JUDGE_TMP_DIR', tmpBase);
    const boxDir = await fs.mkdtemp(
      path.join(tmpBase, `judge-${submissionId}-`),
    );
    // hostTmpBase가 Windows 경로(백슬래시)일 수 있어 POSIX path.join으로는 구분자를 못 알아채므로 직접 결합한다.
    const hostSep = hostTmpBase.includes('\\') ? '\\' : '/';
    const hostBoxDir = `${hostTmpBase.replace(/[\\/]+$/, '')}${hostSep}${path.basename(boxDir)}`;

    try {
      this.assertImageAllowed(runnerConfig.runImage);
      if (runnerConfig.compileCmd)
        this.assertImageAllowed(runnerConfig.compileImage!);

      await fs.writeFile(
        path.join(boxDir, runnerConfig.fileName),
        lease.sourceCode,
        'utf-8',
      );
      await fs.chmod(boxDir, 0o777); // 컨테이너 내부 nobody 유저가 쓸 수 있도록

      // 1) 컴파일 단계 (필요한 언어만)
      if (runnerConfig.compileCmd) {
        const compileResult = await this.sandbox.run({
          image: runnerConfig.compileImage!,
          cmd: runnerConfig.compileCmd,
          binds: [`${hostBoxDir}:/box`],
          timeoutMs: COMPILE_TIMEOUT_MS,
          memoryLimitMb: COMPILE_MEMORY_LIMIT_MB,
        });
        if (
          compileResult.timedOut ||
          compileResult.outputLimitExceeded ||
          compileResult.exitCode !== 0
        ) {
          return {
            leaseId,
            submissionId,
            status: 'COMPILE_ERROR',
            errorMessage: compileResult.outputLimitExceeded
              ? '컴파일 출력이 허용 한도를 초과했습니다.'
              : compileResult.stderr.slice(0, 4000) || '컴파일 실패',
            testResults: [],
          };
        }
      }

      // 2) 테스트케이스 실행
      let finalStatus: JudgeStatus = 'ACCEPTED';
      let maxRuntimeMs = 0;
      let totalScore = 0;
      const testResults: JudgeTestResult[] = [];

      for (const tc of lease.testCases) {
        // stdin은 도커 attach 소켓으로 스트리밍하지 않고 파일로 써서 셸 리다이렉션으로 넘긴다.
        // (Windows의 named pipe 기반 도커 데몬에서 attach stdin 하이재킹이 불안정했음)
        await fs.writeFile(path.join(boxDir, 'input.txt'), tc.input, 'utf-8');
        let runCmd = [
          '/bin/sh',
          '-c',
          `${runnerConfig.runCmd.map(shQuote).join(' ')} < /box/input.txt`,
        ];
        if (lease.problemType === 'INTERACTIVE') {
          await fs.writeFile(
            path.join(boxDir, 'expected.txt'),
            tc.output,
            'utf-8',
          );
          await fs.writeFile(
            path.join(boxDir, 'interactive.sh'),
            [
              '#!/bin/sh',
              'mkfifo /tmp/judge_to_user /tmp/user_to_judge',
              `${runnerConfig.runCmd.map(shQuote).join(' ')} </tmp/judge_to_user >/tmp/user_to_judge 2>/tmp/user.err &`,
              'user_pid=$!',
              'exec 3>/tmp/judge_to_user',
              'exec 4</tmp/user_to_judge',
              'exec 5</box/input.txt',
              'exec 6</box/expected.txt',
              'while IFS= read -r prompt <&5 || [ -n "$prompt" ]; do',
              '  if ! IFS= read -r expected <&6; then kill "$user_pid" 2>/dev/null; exit 42; fi',
              '  printf "%s\\n" "$prompt" >&3 || { kill "$user_pid" 2>/dev/null; exit 43; }',
              '  if ! IFS= read -r actual <&4; then cat /tmp/user.err >&2; exit 43; fi',
              '  printf "%s\\n" "$actual"',
              '  actual_trimmed=$(printf "%s" "$actual" | sed "s/[[:space:]]*$//")',
              '  expected_trimmed=$(printf "%s" "$expected" | sed "s/[[:space:]]*$//")',
              '  if [ "$actual_trimmed" != "$expected_trimmed" ]; then kill "$user_pid" 2>/dev/null; exit 42; fi',
              'done',
              'exec 3>&-',
              'if IFS= read -r extra <&4; then kill "$user_pid" 2>/dev/null; exit 42; fi',
              'wait "$user_pid"',
              'code=$?',
              'if [ "$code" -ne 0 ]; then cat /tmp/user.err >&2; exit 43; fi',
              'exit 0',
              '',
            ].join('\n'),
            'utf-8',
          );
          runCmd = ['/bin/sh', '/box/interactive.sh'];
        }
        const result = await this.sandbox.run({
          image: runnerConfig.runImage,
          cmd: runCmd,
          // 실행 단계에는 읽기 전용으로 마운트한다. 사용자 코드가 /box에 대용량 파일을 써서
          // 호스트 디스크를 고갈시키는 걸 막고, 쓰기는 64MB tmpfs만 허용한다.
          binds: [`${hostBoxDir}:/box:ro`],
          timeoutMs: lease.timeLimitMs,
          memoryLimitMb: lease.memoryLimitMb,
        });

        maxRuntimeMs = Math.max(maxRuntimeMs, result.runtimeMs);

        let status: JudgeStatus;
        if (result.outputLimitExceeded) {
          status = 'RUNTIME_ERROR';
        } else if (result.timedOut) {
          status = 'TIME_LIMIT_EXCEEDED';
        } else if (
          lease.problemType === 'INTERACTIVE' &&
          result.exitCode === 42
        ) {
          status = 'WRONG_ANSWER';
        } else if (result.exitCode !== 0) {
          status = 'RUNTIME_ERROR';
        } else if (
          lease.problemType === 'STANDARD' &&
          !outputsMatch(tc.output, result.stdout)
        ) {
          status = 'WRONG_ANSWER';
        } else {
          status = 'ACCEPTED';
        }

        let score: number | undefined;
        if (status === 'ACCEPTED' && lease.problemType === 'SCORING') {
          const quality = numericScore(
            lease.scoringMode,
            tc.output,
            result.stdout,
          );
          if (quality == null) {
            status = 'WRONG_ANSWER';
          } else {
            score =
              (lease.maxScore / Math.max(lease.testCases.length, 1)) * quality;
            totalScore += score;
          }
        }

        testResults.push({
          testCaseId: tc.id,
          status,
          runtimeMs: result.runtimeMs,
          ...(score !== undefined ? { score } : {}),
          output: result.stdout.slice(0, 2000),
        });

        finalStatus = worseStatus(finalStatus, status);

        // 채점 관례: 첫 실패 테스트케이스에서 조기 종료
        if (status !== 'ACCEPTED') break;
      }

      return {
        leaseId,
        submissionId,
        status: finalStatus,
        runtimeMs: maxRuntimeMs,
        ...(lease.problemType === 'SCORING'
          ? { score: Math.round(totalScore * 10000) / 10000 }
          : {}),
        testResults,
      };
    } catch (err) {
      this.logger.error(
        `채점 중 예외 발생 (submission=${submissionId}): ${err}`,
      );
      return {
        leaseId,
        submissionId,
        status: 'INTERNAL_ERROR',
        errorMessage: String(err).slice(0, 2000),
        testResults: [],
      };
    } finally {
      await fs
        .rm(boxDir, { recursive: true, force: true })
        .catch(() => undefined);
    }
  }
}
