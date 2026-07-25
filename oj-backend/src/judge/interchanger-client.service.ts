import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { JudgeRunnerService } from './judge-runner.service';
import type { JudgeLease, JudgeResult } from './judge-protocol';

const HEARTBEAT_INTERVAL_MS = 10_000;
/** 인터체인저가 롱폴링으로 최대 20초 붙잡으므로 그보다 넉넉하게 잡는다. */
const LEASE_REQUEST_TIMEOUT_MS = 30_000;
const RESULT_REQUEST_TIMEOUT_MS = 30_000;
/** 인터체인저가 잠시 죽었을 때 조용히 폭주하지 않도록 백오프. */
const ERROR_BACKOFF_MS = 5_000;

/**
 * 채점 VM에서 도는 클라이언트. **DB도 Redis도 쓰지 않는다.**
 *
 * 인터체인저로 아웃바운드 연결만 하므로 채점 VM은 인바운드 포트를 하나도 열 필요가 없다
 * (방화벽에서 인바운드 전면 차단 가능). 이게 "채점기는 남의 코드를 실행하는 가장 위험한
 * 컴포넌트"라는 사실에 대한 구조적 방어다.
 */
@Injectable()
export class InterchangerClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InterchangerClientService.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly workerId = `judge-${randomUUID().slice(0, 8)}`;
  private readonly concurrency: number;
  private inFlight = 0;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly runner: JudgeRunnerService,
  ) {
    this.baseUrl = this.config.get<string>('INTERCHANGER_URL', '').replace(/\/+$/, '');
    this.token = this.config.get<string>('JUDGE_SERVICE_TOKEN', '');
    const requested = Number(this.config.get<string>('JUDGE_CONCURRENCY', '2')) || 2;
    this.concurrency = Math.min(Math.max(Math.trunc(requested), 1), 8);
  }

  onModuleInit(): void {
    if (!this.baseUrl) {
      this.logger.warn('INTERCHANGER_URL이 없어 채점 루프를 시작하지 않습니다.');
      return;
    }
    this.running = true;
    void this.loop();
    this.logger.log(`채점 워커 ${this.workerId} 시작 (동시 ${this.concurrency}건, → ${this.baseUrl})`);
  }

  onModuleDestroy(): void {
    this.running = false;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      const capacity = this.concurrency - this.inFlight;
      if (capacity <= 0) {
        await this.sleep(200);
        continue;
      }
      try {
        const leases = await this.requestLeases(capacity);
        // 롱폴링이라 빈 응답은 정상이다(그냥 일감이 없었던 것).
        for (const lease of leases) void this.handle(lease);
      } catch (err) {
        this.logger.error(`리스 요청 실패: ${err}`);
        await this.sleep(ERROR_BACKOFF_MS);
      }
    }
  }

  private async handle(lease: JudgeLease): Promise<void> {
    this.inFlight++;
    // 채점이 리스보다 오래 걸릴 수 있으니 주기적으로 살아있음을 알린다.
    // 410(회수됨)을 받으면 결과를 보내지 않고 버린다 - 이미 다른 워커에 재배달됐기 때문이다.
    let revoked = false;
    const heartbeat = setInterval(() => {
      void this.sendHeartbeat(lease.leaseId).then((alive) => {
        if (!alive) revoked = true;
      });
    }, HEARTBEAT_INTERVAL_MS);

    try {
      const result = await this.runner.run(lease);
      if (revoked) {
        this.logger.warn(`리스가 회수되어 결과를 폐기합니다 (submission=${lease.submissionId})`);
        return;
      }
      await this.sendResult(result);
    } catch (err) {
      this.logger.error(`채점 처리 실패 (submission=${lease.submissionId}): ${err}`);
    } finally {
      clearInterval(heartbeat);
      this.inFlight--;
    }
  }

  private async requestLeases(capacity: number): Promise<JudgeLease[]> {
    const res = await this.post(
      '/internal/judge/lease',
      { workerId: this.workerId, capacity },
      LEASE_REQUEST_TIMEOUT_MS,
    );
    if (!res.ok) throw new Error(`lease ${res.status}`);
    const body = (await res.json()) as { leases?: JudgeLease[] };
    return body.leases ?? [];
  }

  /** 살아있으면 true, 리스가 회수됐으면(410) false. */
  private async sendHeartbeat(leaseId: string): Promise<boolean> {
    try {
      const res = await this.post('/internal/judge/heartbeat', { leaseId }, 10_000);
      if (res.status === 410) return false;
      return res.ok;
    } catch (err) {
      // 네트워크 문제로 하트비트가 한 번 실패한 것만으로 채점을 버리진 않는다.
      this.logger.warn(`하트비트 실패(${leaseId}): ${err}`);
      return true;
    }
  }

  private async sendResult(result: JudgeResult): Promise<void> {
    const res = await this.post('/internal/judge/result', result, RESULT_REQUEST_TIMEOUT_MS);
    if (!res.ok) throw new Error(`result ${res.status}`);
  }

  private post(path: string, body: unknown, timeoutMs: number): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
