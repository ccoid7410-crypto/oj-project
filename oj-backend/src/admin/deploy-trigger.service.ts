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

const DEPLOY_REQUEST_TIMEOUT_MS = 11 * 60 * 1000; // 배포 에이전트의 단계별 10분 타임아웃보다 여유

export interface DeployAgentResult {
  ok: boolean;
  steps: Array<{ step: string; ok: boolean; output: string }>;
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

  async trigger(userId: string, password: string): Promise<DeployAgentResult> {
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
    const res = await fetch(`${this.baseUrl}/deploy`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(DEPLOY_REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new ServiceUnavailableException(
        `배포 에이전트 응답 오류: ${res.status}`,
      );
    }
    const result = (await res.json()) as DeployAgentResult;
    this.logger.log(
      `배포 결과 (요청자: ${user.username}): ${result.ok ? '성공' : '실패'}`,
    );
    return result;
  }
}
