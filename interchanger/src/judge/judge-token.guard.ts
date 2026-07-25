import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { extractBearerToken, serviceTokenAccepted } from '../common/service-token';

/**
 * 채점 VM만 통과시키는 가드. 내부 리스너(:4001)의 모든 라우트에 걸린다.
 *
 * 채점 VM은 인바운드 포트를 하나도 열지 않고 여기로 아웃바운드 연결만 하므로,
 * 이 토큰이 두 VM 사이의 유일한 인증 수단이다.
 */
@Injectable()
export class JudgeTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const presented = extractBearerToken(request.headers.authorization);
    const expected = this.config.get<string>('JUDGE_SERVICE_TOKEN', '');
    const previous = this.config.get<string>('JUDGE_SERVICE_TOKEN_PREV', '');

    if (!serviceTokenAccepted(presented, expected, previous || undefined)) {
      throw new UnauthorizedException('채점 서비스 토큰이 올바르지 않습니다.');
    }
    return true;
  }
}
