import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../../auth/jwt.strategy';
import type { AuthenticatedRequest } from '../http-request.types';

export const CurrentUser = createParamDecorator<RequestUser>(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
