import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { JudgePayloadService } from '../internal/judge-payload.service';
import { JudgeIngestService } from '../internal/judge-ingest.service';
import { JudgeRunnerService } from './judge-runner.service';
import { JUDGE_QUEUE, JudgeJobData } from './judge.constants';

// 라즈베리파이 4B(8GB) 같은 저사양 호스트에서는 동시 채점 개수를 낮춰야 컴파일 단계에서
// 메모리 압박이 덜하다. docker-compose가 컨테이너 기동 시 실제 OS 환경변수로 주입하므로
// (dotenv 타이밍과 무관하게) 데코레이터 평가 시점에 이미 값이 존재한다.
const requestedConcurrency = Number(process.env.JUDGE_CONCURRENCY) || 2;
const JUDGE_CONCURRENCY = Math.min(Math.max(Math.trunc(requestedConcurrency), 1), 8);

/**
 * BullMQ 기반 채점 프로세서 (과도기 형태).
 *
 * 채점의 실제 실행은 JudgeRunnerService(순수, DB 없음)로, DB 접근은 payload/ingest 서비스로
 * 이미 분리돼 있다. 인터체인저가 들어오는 3단계에서 이 파일은 통째로 삭제되고,
 * 채점 VM에서는 "인터체인저에서 리스를 당겨와 러너에 넘기는" 클라이언트가 대신 들어간다.
 */
@Processor(JUDGE_QUEUE, { concurrency: JUDGE_CONCURRENCY })
export class JudgeProcessor extends WorkerHost {
  private readonly logger = new Logger(JudgeProcessor.name);

  constructor(
    private readonly payload: JudgePayloadService,
    private readonly runner: JudgeRunnerService,
    private readonly ingest: JudgeIngestService,
  ) {
    super();
  }

  async process(job: Job<JudgeJobData>): Promise<void> {
    const { submissionId } = job.data;

    let payload;
    try {
      payload = await this.payload.build(submissionId);
    } catch (err) {
      this.logger.error(`채점 재료를 만들지 못했습니다 (submission=${submissionId}): ${err}`);
      return;
    }

    await this.ingest.markJudging(submissionId);

    const result = await this.runner.run({
      ...payload,
      leaseId: randomUUID(),
      attempt: 1,
      expiresAt: Date.now() + 180_000,
    });

    await this.ingest.ingest(result);
  }
}
