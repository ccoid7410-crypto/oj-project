import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtAuthGuard와 달리 토큰이 없거나 유효하지 않아도 요청을 막지 않는다.
 * 로그인 여부에 따라 응답을 조금 다르게 주고 싶은 "공개" 엔드포인트(문제/대회 상세)에 쓴다.
 * 유효한 토큰이 있으면 req.user가 채워지고, 없으면 그냥 undefined로 통과한다.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    if (
      user &&
      typeof user === 'object' &&
      'mustChangePassword' in user &&
      (user as { mustChangePassword?: boolean }).mustChangePassword
    ) {
      return undefined as TUser;
    }
    return user;
  }
}
