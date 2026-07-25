import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JudgePayload, JudgeResult } from './judge-protocol';

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * API 서버의 내부 리스너에 붙는 클라이언트.
 *
 * 인터체인저는 **Postgres 자격증명을 갖지 않는다.** DB가 필요한 일은 전부 여기를 통해
 * API에 위임한다. 그래서 Prisma 클라이언트가 이 프로세스에 존재하지 않고, 스키마 드리프트나
 * 마이그레이션 경쟁도 생기지 않는다.
 */
@Injectable()
export class ApiClientService {
  private readonly logger = new Logger(ApiClientService.name);
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('API_INTERNAL_URL', 'http://api:3001').replace(/\/+$/, '');
    this.token = config.get<string>('INTERNAL_API_TOKEN', '');
  }

  async fetchPayload(submissionId: string): Promise<JudgePayload | null> {
    const res = await this.request('GET', `/internal/judge/payload/${encodeURIComponent(submissionId)}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new InternalServerErrorException(`채점 재료 조회 실패: ${res.status}`);
    }
    return (await res.json()) as JudgePayload;
  }

  async markJudging(submissionId: string): Promise<void> {
    const res = await this.request('POST', '/internal/judge/status', { submissionId });
    if (!res.ok) this.logger.warn(`채점 시작 알림 실패(${submissionId}): ${res.status}`);
  }

  async ingest(result: Omit<JudgeResult, 'leaseId'>): Promise<{ duplicate: boolean }> {
    const res = await this.request('POST', '/internal/judge/ingest', result);
    if (!res.ok) {
      throw new InternalServerErrorException(`채점 결과 반영 실패: ${res.status}`);
    }
    return (await res.json()) as { duplicate: boolean };
  }

  private request(method: string, path: string, body?: unknown): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }
}
