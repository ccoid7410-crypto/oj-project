import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { RatingService } from '../rating/rating.service';
import { SUBMISSION_UPDATES_CHANNEL } from '../common/realtime.constants';
import type { JudgeResult } from '../judge/judge-protocol';
import { SubmissionStatus } from '@prisma/client';

/** 채점기가 보낸 값은 신뢰 경계 바깥에서 왔으므로 저장 전에 다시 자른다. */
const MAX_ERROR_MESSAGE = 2000;
const MAX_TEST_OUTPUT = 2000;

/**
 * 채점 결과를 DB에 반영하는 유일한 경로. **API 프로세스에만 존재한다.**
 *
 * 채점 VM은 DB에 못 붙으므로 결과가 반드시 여기를 지나가고, 그 덕에 멱등성·레이팅 재계산·
 * 실시간 방송을 한곳에서 보장할 수 있다.
 */
@Injectable()
export class JudgeIngestService {
  private readonly logger = new Logger(JudgeIngestService.name);
  private readonly publisher: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rating: RatingService,
    config: ConfigService,
  ) {
    this.publisher = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
    });
  }

  /** 채점 시작 알림. 최종 상태가 아니므로 판정 필드는 건드리지 않는다. */
  async markJudging(submissionId: string): Promise<void> {
    const updated = await this.prisma.submission.updateMany({
      where: { id: submissionId, status: 'PENDING' },
      data: { status: 'JUDGING' },
    });
    if (updated.count === 1) {
      await this.publish({ submissionId, status: 'JUDGING' });
    }
  }

  /**
   * 채점 결과 반영. **여러 번 호출해도 안전하다.**
   *
   * 멱등성의 열쇠는 updateMany의 `status: {in: ['PENDING','JUDGING']}` 필터다.
   * 이미 확정된 제출에 두 번째 결과가 오면 0행이 갱신되고 그대로 빠져나간다 -
   * 리스 재배달이나 좀비 워커의 뒤늦은 보고로 결과가 덮어써지거나 레이팅이
   * 두 번 계산되는 일이 없다.
   */
  async ingest(result: JudgeResult): Promise<{ duplicate: boolean }> {
    const { submissionId, status } = result;
    const scoreLimitRow = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { problem: { select: { maxScore: true } } },
    });
    const scoreLimit = Math.max(0, scoreLimitRow?.problem.maxScore ?? 0);
    const safeScore =
      result.score !== undefined && Number.isFinite(result.score)
        ? Math.min(Math.max(result.score, 0), scoreLimit)
        : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.submission.updateMany({
        where: { id: submissionId, status: { in: ['PENDING', 'JUDGING'] } },
        data: {
          status: SubmissionStatus[status],
          judgedAt: new Date(),
          runtimeMs: result.runtimeMs ?? null,
          memoryKb: result.memoryKb ?? null,
          score: safeScore,
          errorMessage:
            result.errorMessage?.slice(0, MAX_ERROR_MESSAGE) ?? null,
        },
      });
      if (updateResult.count !== 1) return 0;

      // 재배달로 부분 결과가 남아있을 수 있으니 지우고 새로 쓴다.
      // (@@unique([submissionId,testCaseId]) + upsert 대신 이 방식을 쓰면 마이그레이션이 필요 없다)
      await tx.submissionTestResult.deleteMany({ where: { submissionId } });
      if (result.testResults.length > 0) {
        await tx.submissionTestResult.createMany({
          data: result.testResults.map((tr) => ({
            submissionId,
            testCaseId: tr.testCaseId,
            status: SubmissionStatus[tr.status],
            runtimeMs: tr.runtimeMs,
            score:
              tr.score !== undefined && Number.isFinite(tr.score)
                ? Math.min(Math.max(tr.score, 0), scoreLimit)
                : null,
            output: tr.output.slice(0, MAX_TEST_OUTPUT),
          })),
        });
      }
      return updateResult.count;
    });

    if (updated !== 1) {
      this.logger.warn(
        `이미 확정된 제출에 대한 중복 결과 보고를 무시했습니다: ${submissionId}`,
      );
      return { duplicate: true };
    }

    // 레이팅 재계산은 반드시 "이번 호출이 실제로 상태를 확정시켰을 때"만 돈다.
    if (status === 'ACCEPTED') {
      const submission = await this.prisma.submission.findUnique({
        where: { id: submissionId },
        select: { userId: true, problemId: true },
      });
      if (submission) {
        const firstAccept = await this.rating.isFirstAccept(
          submission.userId,
          submission.problemId,
        );
        if (firstAccept) await this.rating.recomputeForUser(submission.userId);
      }
    }

    // 이 발행 하나가 두 가지 일을 한다: 브라우저 실시간 갱신(SubmissionGateway)과
    // 결과를 기다리던 요청 깨우기(SubmissionCompletionSubscriber).
    // 후자를 여기서 직접 부르지 않는 이유는, 결과를 쓰는 프로세스와 기다리는 프로세스가
    // 다를 수 있어서다(과도기의 채점 워커 / 향후 API 다중화).
    await this.publish({
      submissionId,
      status,
      ...(result.runtimeMs !== undefined
        ? { runtimeMs: result.runtimeMs }
        : {}),
      ...(result.memoryKb !== undefined ? { memoryKb: result.memoryKb } : {}),
      ...(safeScore !== null ? { score: safeScore } : {}),
      ...(result.errorMessage
        ? { errorMessage: result.errorMessage.slice(0, MAX_ERROR_MESSAGE) }
        : {}),
    });

    return { duplicate: false };
  }

  private async publish(payload: Record<string, unknown>): Promise<void> {
    await this.publisher.publish(
      SUBMISSION_UPDATES_CHANNEL,
      JSON.stringify(payload),
    );
  }
}
