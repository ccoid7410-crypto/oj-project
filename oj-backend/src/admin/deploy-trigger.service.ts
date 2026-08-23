import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

// 에이전트는 배포를 백그라운드로 돌리고 바로 답하므로 오래 기다릴 일이 없다.
const DEPLOY_REQUEST_TIMEOUT_MS = 15_000;

export interface DeployStepResult {
  step: string;
  ok: boolean;
  output: string;
}

export interface DeployStatus {
  running: boolean;
  ok: boolean | null;
  steps: DeployStepResult[];
  startedAt: string | null;
  finishedAt: string | null;
}

@Injectable()
export class DeployTriggerService {
  private readonly logger = new Logger(DeployTriggerService.name);
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config
      .get<string>('DEPLOY_AGENT_URL', '')
      .replace(/\/+$/, '');
    this.token = this.config.get<string>('DEPLOY_SERVICE_TOKEN', '');
  }

  /** 서버 정보(내부 LAN IP)는 setup.sh가 감지해 .env에 채워둔 값을 그대로 보여준다. */
  getServerInfo() {
    return {
      lanIp: this.config.get<string>('SERVER_LAN_IP', '') || null,
    };
  }

  async trigger(userId: string, password: string): Promise<{ started: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) throw new ForbiddenException('비밀번호가 올바르지 않습니다.');

    if (!this.baseUrl) {
      throw new ServiceUnavailableException(
        '배포 에이전트가 설정되지 않았습니다(DEPLOY_AGENT_URL 없음).',
      );
    }

    this.logger.log(`배포 트리거됨 (요청자: ${user.username})`);
    return this.callAgent<{ started: boolean }>('/deploy', 'POST');
  }

  /**
   * 진행 상황 조회. 배포 마지막 단계에서 api 컨테이너까지 재생성되므로, 이 요청 자체가
   * 잠깐 실패할 수 있다 - 프론트는 그걸 "재시작 중"으로 보고 계속 물어본다.
   */
  async status(): Promise<DeployStatus> {
    if (!this.baseUrl) {
      throw new ServiceUnavailableException(
        '배포 에이전트가 설정되지 않았습니다(DEPLOY_AGENT_URL 없음).',
      );
    }
    return this.callAgent<DeployStatus>('/deploy/status', 'GET');
  }

  private async callAgent<T>(path: string, method: 'GET' | 'POST'): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(DEPLOY_REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new ServiceUnavailableException(
        `배포 에이전트 응답 오류: ${res.status}`,
      );
    }
    return (await res.json()) as T;
  }
}
