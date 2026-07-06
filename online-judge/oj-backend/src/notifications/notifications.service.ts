import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** 관리자 알림함(지금은 난이도 투표 급변 경보 전용). */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: { type: string; message: string; problemId?: string; voterId?: string }) {
    return this.prisma.adminNotification.create({ data: params });
  }

  async list(onlyUnread = false) {
    return this.prisma.adminNotification.findMany({
      where: onlyUnread ? { read: false } : undefined,
      include: {
        problem: { select: { displayId: true, title: true, slug: true } },
        voter: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async unreadCount() {
    return this.prisma.adminNotification.count({ where: { read: false } });
  }

  async markRead(id: string) {
    return this.prisma.adminNotification.update({ where: { id }, data: { read: true } });
  }

  async markAllRead() {
    await this.prisma.adminNotification.updateMany({ where: { read: false }, data: { read: true } });
    return { success: true };
  }
}
