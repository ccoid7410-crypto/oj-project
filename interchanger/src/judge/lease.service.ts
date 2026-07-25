import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { ApiClientService } from './api-client.service';
import type { JudgeLease, JudgeResult } from './judge-protocol';

const JUDGE_QUEUE = 'judge-queue';

/** 리스 만료 시간 계산 범위. 테스트케이스가 많은 문제일수록 길게 잡는다. */
const MIN_LEASE_TTL_MS = 30_000;
const MAX_LEASE_TTL_MS = 180_000;
const COMPILE_BUDGET_MS = 10_000;
const LEASE_SLACK_MS = 15_000;

const MAX_ATTEMPTS = 2;
const SWEEP_INTERVAL_MS = 15_000;

/**
 * Redis 키를 논리적 만료(expiresAt)보다 훨씬 오래 살려둔다.
 *
 * 처음엔 키 TTL을 리스 수명과 같게 줬는데, 그러면 Redis가 먼저 키를 지워버려서
 * 스위퍼가 "만료된 리스"를 영영 발견하지 못한다 - 재배달도 INTERNAL_ERROR 확정도
 * 일어나지 않고 제출이 JUDGING에 그대로 멈춰 있었다(고치려던 바로 그 버그가 재현됐다).
 * 그래서 키 TTL은 스위퍼가 처리하지 못하고 프로세스가 죽었을 때를 위한 최후의 청소용으로만 쓴다.
 */
const LEASE_KEY_GRACE_MS = 10 * 60_000;

interface LeaseRecord {
  submissionId: string;
  jobId: string;
  token: string;
  attempt: number;
  workerId: string;
  testCaseIds: string[];
  expiresAt: number;
}

/**
 * 채점 작업의 배달과 결과 수거를 책임진다.
 *
 * 핵심은 "리스"다. 채점 VM은 자기가 정당하게 받아간 작업에 대해서만 결과를 쓸 수 있고,
 * 리스가 만료되면(= 워커가 죽었으면) 작업이 자동으로 회수되어 다시 배달된다.
 * 예전엔 attempts:1 이라 워커가 채점 중 죽으면 그 제출이 영원히 JUDGING에 멈춰 있었다.
 */
@Injectable()
export class LeaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeaseService.name);
  private readonly redis: Redis;
  private queue!: Queue;
  private worker!: Worker;
  private sweepTimer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly api: ApiClientService,
  ) {
    this.redis = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      maxRetriesPerRequest: null,
    });
  }

  onModuleInit(): void {
    const connection = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
    };
    this.queue = new Queue(JUDGE_QUEUE, { connection });
    // Worker를 autorun 없이 만들어 잠금(lock) 관리 기능만 빌려 쓴다.
    // 실제 실행은 다른 VM에서 하므로 여기서 job을 처리하지는 않는다.
    this.worker = new Worker(JUDGE_QUEUE, undefined, { connection, autorun: false });
    this.sweepTimer = setInterval(() => {
      this.sweepExpired().catch((err) => this.logger.error(`리스 회수 실패: ${err}`));
    }, SWEEP_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    await Promise.allSettled([this.worker?.close(), this.queue?.close(), this.redis.quit()]);
  }

  /** 큐에서 최대 capacity개를 꺼내 리스로 만들어 준다. */
  async lease(workerId: string, capacity: number): Promise<JudgeLease[]> {
    const leases: JudgeLease[] = [];
    for (let i = 0; i < capacity; i++) {
      const lease = await this.leaseOne(workerId);
      if (!lease) break;
      leases.push(lease);
    }
    return leases;
  }

  private async leaseOne(workerId: string): Promise<JudgeLease | null> {
    const token = randomUUID();
    const job = await this.worker.getNextJob(token);
    if (!job) return null;

    const submissionId = (job.data as { submissionId?: string })?.submissionId;
    if (!submissionId) {
      this.logger.warn(`submissionId 없는 작업을 폐기합니다: ${job.id}`);
      await job.moveToFailed(new Error('submissionId 없음'), token, false);
      return null;
    }

    let payload;
    try {
      payload = await this.api.fetchPayload(submissionId);
    } catch (err) {
      // API가 일시적으로 안 될 수 있다. 작업을 잃지 않도록 잠금만 풀어 큐에 돌려놓는다.
      this.logger.error(`채점 재료 조회 실패(${submissionId}): ${err}`);
      try {
        await job.moveToWait(token);
      } catch (requeueError) {
        // 잠금 상태가 예상과 달라 재큐잉도 실패했다면 BullMQ의 stalled 복구에 맡긴다.
        // failed로 옮기면 운영자가 수동 retry하기 전까지 제출이 영구 PENDING으로 남는다.
        this.logger.error(`채점 작업 재큐잉 실패(${job.id}): ${requeueError}`);
      }
      return null;
    }
    if (!payload) {
      this.logger.warn(`제출이 사라져 작업을 폐기합니다: ${submissionId}`);
      await job.moveToCompleted('gone', token, false).catch(() => undefined);
      return null;
    }

    // 재배달 횟수는 BullMQ의 attemptsMade가 아니라 우리가 직접 센다
    // (getNextJob 방식에서는 attemptsMade가 우리 의도대로 증가하지 않는다).
    const attempt = ((await this.redis.get(this.attemptKey(submissionId))) ? 2 : 1);
    const ttl = this.leaseTtlMs(payload.testCases.length, payload.timeLimitMs);
    const leaseId = randomUUID();
    const expiresAt = Date.now() + ttl;

    const record: LeaseRecord = {
      submissionId,
      jobId: String(job.id),
      token,
      attempt,
      workerId,
      // 결과 검증용: 이 리스에서 실제로 내려준 테스트케이스 id만 결과로 인정한다.
      testCaseIds: payload.testCases.map((tc) => tc.id),
      expiresAt,
    };
    await this.storeLease(leaseId, record);
    await this.redis.set(this.attemptKey(submissionId), String(attempt), 'PX', MAX_LEASE_TTL_MS * 4);

    await this.api.markJudging(submissionId);

    return { ...payload, leaseId, attempt, expiresAt };
  }

  /** 채점 중인 워커가 살아있음을 알린다. 만료된 리스면 null을 돌려 채점을 중단시킨다. */
  async heartbeat(leaseId: string): Promise<LeaseRecord | null> {
    const record = await this.readLease(leaseId);
    if (!record) return null;
    // 키는 스위퍼가 볼 수 있도록 만료 후에도 남아있으므로, 논리적 만료를 직접 확인한다.
    // 여기서 살아있다고 답하면 이미 재배달된 작업을 좀비 워커가 계속 붙들게 된다.
    if (record.expiresAt <= Date.now()) return null;

    const ttl = Math.max(MIN_LEASE_TTL_MS, record.expiresAt - Date.now() + MIN_LEASE_TTL_MS);
    record.expiresAt = Date.now() + ttl;
    await this.storeLease(leaseId, record);
    await this.extendJobLock(record, ttl);
    return record;
  }

  /**
   * 채점 결과를 받는다. 리스와 대조해 검증한 뒤에만 API로 넘긴다.
   * 이미 소비된 리스면 duplicate로 처리하고 아무것도 하지 않는다.
   */
  async submitResult(result: JudgeResult): Promise<{ accepted: boolean; duplicate: boolean; reason?: string }> {
    const record = await this.readLease(result.leaseId);
    if (!record) {
      // 리스가 없다 = 이미 처리됐거나 만료돼 회수됐다. 어느 쪽이든 이 결과는 버린다.
      return { accepted: false, duplicate: true };
    }
    if (record.submissionId !== result.submissionId) {
      return { accepted: false, duplicate: false, reason: '리스와 제출 ID가 일치하지 않습니다.' };
    }
    // 리스에서 내려주지 않은 테스트케이스에 결과를 쓰려는 시도를 차단한다.
    const allowed = new Set(record.testCaseIds);
    const forged = result.testResults.find((tr) => !allowed.has(tr.testCaseId));
    if (forged) {
      return { accepted: false, duplicate: false, reason: '리스에 없는 테스트케이스가 포함돼 있습니다.' };
    }

    // 먼저 리스를 소비한다. DEL이 0이면 그 사이 다른 요청이 이미 가져갔다는 뜻이다.
    const consumed = await this.redis.del(this.leaseKey(result.leaseId));
    if (consumed === 0) return { accepted: false, duplicate: true };

    const { leaseId: _ignored, ...body } = result;
    const ingested = await this.api.ingest(body);

    await this.completeJob(record);
    await this.redis.del(this.attemptKey(record.submissionId));

    return { accepted: true, duplicate: ingested.duplicate };
  }

  /**
   * 만료된 리스를 회수한다. 1차 시도였으면 다시 큐에 넣고, 2차까지 실패했으면
   * INTERNAL_ERROR로 확정해서 제출이 영원히 JUDGING에 머무는 걸 막는다.
   */
  private async sweepExpired(): Promise<void> {
    const keys = await this.scanLeaseKeys();
    for (const key of keys) {
      const raw = await this.redis.get(key);
      if (!raw) continue;
      let record: LeaseRecord;
      try {
        record = JSON.parse(raw) as LeaseRecord;
      } catch {
        await this.redis.del(key);
        continue;
      }
      if (record.expiresAt > Date.now()) continue;

      // 회수 경쟁 방지: DEL에 성공한 쪽만 처리한다.
      if ((await this.redis.del(key)) === 0) continue;

      if (record.attempt < MAX_ATTEMPTS) {
        this.logger.warn(`리스 만료 - 재배달합니다 (submission=${record.submissionId})`);
        await this.requeue(record);
      } else {
        this.logger.error(`리스 2회 만료 - INTERNAL_ERROR로 확정합니다 (submission=${record.submissionId})`);
        await this.api
          .ingest({
            submissionId: record.submissionId,
            status: 'INTERNAL_ERROR',
            errorMessage: '채점 서버가 응답하지 않아 채점을 완료하지 못했습니다.',
            testResults: [],
          })
          .catch((err) => this.logger.error(`INTERNAL_ERROR 확정 실패: ${err}`));
        await this.completeJob(record);
        await this.redis.del(this.attemptKey(record.submissionId));
      }
    }
  }

  private async requeue(record: LeaseRecord): Promise<void> {
    await this.completeJob(record);
    await this.queue.add(
      'judge',
      { submissionId: record.submissionId },
      { attempts: 1, removeOnComplete: 1000, removeOnFail: 1000 },
    );
  }

  /** 잠금을 쥔 채 끝내야 BullMQ가 stalled로 오인하지 않는다. 실패해도 흐름은 막지 않는다. */
  private async completeJob(record: LeaseRecord): Promise<void> {
    try {
      const job = await this.queue.getJob(record.jobId);
      await job?.moveToCompleted('done', record.token, false);
    } catch (err) {
      this.logger.debug(`작업 완료 처리 생략(${record.jobId}): ${err}`);
    }
  }

  private async extendJobLock(record: LeaseRecord, ttl: number): Promise<void> {
    try {
      const job = await this.queue.getJob(record.jobId);
      await job?.extendLock(record.token, ttl);
    } catch (err) {
      this.logger.debug(`작업 잠금 연장 생략(${record.jobId}): ${err}`);
    }
  }

  /** 키 자체는 논리 만료보다 오래 살려둔다(위 LEASE_KEY_GRACE_MS 설명 참고). */
  private async storeLease(leaseId: string, record: LeaseRecord): Promise<void> {
    const keyTtl = Math.max(record.expiresAt - Date.now(), 0) + LEASE_KEY_GRACE_MS;
    await this.redis.set(this.leaseKey(leaseId), JSON.stringify(record), 'PX', keyTtl);
  }

  private async readLease(leaseId: string): Promise<LeaseRecord | null> {
    if (!leaseId) return null;
    const raw = await this.redis.get(this.leaseKey(leaseId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LeaseRecord;
    } catch {
      return null;
    }
  }

  private async scanLeaseKeys(): Promise<string[]> {
    const found: string[] = [];
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', 'judge:lease:*', 'COUNT', 100);
      cursor = next;
      found.push(...keys);
    } while (cursor !== '0');
    return found;
  }

  private leaseTtlMs(testCaseCount: number, timeLimitMs: number): number {
    const budget = COMPILE_BUDGET_MS + testCaseCount * timeLimitMs * 1.5 + LEASE_SLACK_MS;
    return Math.min(Math.max(Math.trunc(budget), MIN_LEASE_TTL_MS), MAX_LEASE_TTL_MS);
  }

  private leaseKey(leaseId: string): string {
    return `judge:lease:${leaseId}`;
  }

  private attemptKey(submissionId: string): string {
    return `judge:attempt:${submissionId}`;
  }
}
