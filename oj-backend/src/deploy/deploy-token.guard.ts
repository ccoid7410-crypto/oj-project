import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import {
  extractBearerToken,
  serviceTokenAccepted,
} from '../common/service-token';

/**
 * 배포 에이전트 전용 인증. INTERNAL_API_TOKEN/JUDGE_SERVICE_TOKEN과 별도 토큰을 쓴다 -
 * docker.sock을 쥔 이 서비스는 사실상 호스트 root와 동급이라, 다른 서비스 토큰이
 * 유출됐다고 해서 같이 뚫리지 않도록 블라스트 반경을 분리한다.
 */
@Injectable()
export class DeployTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const presented = extractBearerToken(request.headers.authorization);
    const expected = this.config.get<string>('DEPLOY_SERVICE_TOKEN', '');

    if (!serviceTokenAccepted(presented, expected)) {
      throw new UnauthorizedException('배포 서비스 토큰이 올바르지 않습니다.');
    }
    return true;
  }
}
