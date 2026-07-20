import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { RequestUser } from '../jwt.strategy';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = await (super.canActivate(context) as Promise<boolean>);
    if (!allowed) return false;

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    if (!request.user?.mustChangePassword) return true;

    const path = (request.originalUrl || request.url).split('?')[0].replace(/^\/api/, '');
    const mayFinishAccountSetup =
      (request.method === 'GET' && path === '/users/me') ||
      (request.method === 'POST' && path === '/users/me/change-password') ||
      (request.method === 'POST' && path === '/users/me/delete-account');
    if (!mayFinishAccountSetup) {
      throw new ForbiddenException('임시 비밀번호를 먼저 변경해야 합니다.');
    }
    return true;
  }
}
