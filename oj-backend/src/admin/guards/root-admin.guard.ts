import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestUser } from '../../auth/jwt.strategy';

const ROOT_ADMIN_USERNAME = 'jihun1050';

@Injectable()
export class RootAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const userId = request.user?.userId;
    if (!userId) throw new ForbiddenException('메인 관리자만 수정할 수 있습니다.');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, role: true },
    });
    if (user?.username !== ROOT_ADMIN_USERNAME || user.role !== 'ADMIN') {
      throw new ForbiddenException('jihun1050 관리자만 수정할 수 있습니다.');
    }
    return true;
  }
}
