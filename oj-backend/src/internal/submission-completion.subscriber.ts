import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { SUBMISSION_UPDATES_CHANNEL } from '../common/realtime.constants';
import { isJudgeVerdict } from '../judge/judge-protocol';
import { SubmissionCompletionRegistry } from './submission-completion.registry';

/**
 * 채점 완료 신호를 Redis 채널에서 받아 대기 중인 요청을 깨운다.
 *
 * 왜 프로세스 안에서 직접 부르지 않고 Redis를 거치나:
 * 결과를 확정하는 쪽(채점 파이프라인)과 기다리는 쪽(문제 검증 HTTP 요청)이 **다른 프로세스일 수
 * 있기 때문이다.** 실제로 과도기에는 채점 워커가 결과를 쓰고 API가 기다리는 구조였고, 이때
 * 프로세스 로컬 Map만 쓰면 신호가 영영 도착하지 않아 매번 30초 타임아웃이 났다.
 * 채널을 거치면 배치가 어떻게 바뀌든(워커 분리, API 다중화) 항상 동작한다.
 */
@Injectable()
export class SubmissionCompletionSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubmissionCompletionSubscriber.name);
  private subscriber?: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly completions: SubmissionCompletionRegistry,
  ) {}

  onModuleInit(): void {
    this.subscriber = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
    });
    this.subscriber.subscribe(SUBMISSION_UPDATES_CHANNEL, (err) => {
      if (err) this.logger.error(`채점 완료 채널 구독 실패: ${err.message}`);
    });
    this.subscriber.on('message', (_channel, message) => {
      try {
        const payload = JSON.parse(message) as { submissionId?: unknown; status?: unknown };
        // JUDGING은 진행 상태라 완료가 아니다. 최종 판정일 때만 깨운다.
        if (typeof payload.submissionId !== 'string' || !isJudgeVerdict(payload.status)) return;
        this.completions.complete(payload.submissionId, payload.status);
      } catch {
        // 형식이 깨진 메시지는 게이트웨이 쪽에서 이미 경고를 남기므로 여기선 조용히 무시한다.
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber?.quit().catch(() => undefined);
  }
}
