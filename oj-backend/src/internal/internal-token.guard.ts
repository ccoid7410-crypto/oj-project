import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { extractBearerToken, serviceTokenAccepted } from '../common/service-token';

/**
 * 내부 리스너(:3001) 전용 인증. 인터체인저만 통과할 수 있다.
 *
 * 이 리스너는 compose 내부망에만 떠 있고 nginx가 프록시하지 않으므로 브라우저에서 닿을 수 없지만,
 * 네트워크 격리만 믿지 않고 토큰도 함께 요구한다(방어 계층 이중화).
 */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const presented = extractBearerToken(request.headers.authorization);
    const expected = this.config.get<string>('INTERNAL_API_TOKEN', '');
    const previous = this.config.get<string>('INTERNAL_API_TOKEN_PREV', '');

    if (!serviceTokenAccepted(presented, expected, previous || undefined)) {
      throw new UnauthorizedException('내부 서비스 토큰이 올바르지 않습니다.');
    }
    return true;
  }
}
