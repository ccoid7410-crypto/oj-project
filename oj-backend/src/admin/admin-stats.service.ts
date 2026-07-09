import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      userCount,
      memberCount,
      bannedCount,
      problemCounts,
      submissionsToday,
      submissionsTotal,
      pendingJudging,
      recentInternalErrors,
      recentCompileErrors,
    ] = await Promise.all([
      this.prisma.user.count(),
      // 부원 가입자: 관리자도 부원이므로 MEMBER 이상을 센다
      this.prisma.user.count({ where: { role: { in: ['MEMBER', 'ADMIN'] } } }),
      this.prisma.user.count({ where: { banned: true } }),
      this.prisma.problem.groupBy({ by: ['status'], _count: true }),
      this.prisma.submission.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.submission.count(),
      this.prisma.submission.count({ where: { status: { in: ['PENDING', 'JUDGING'] } } }),
      this.prisma.submission.count({
        where: { status: 'INTERNAL_ERROR', createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
      }),
      this.prisma.submission.count({
        where: { status: 'COMPILE_ERROR', createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
      }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const row of problemCounts) byStatus[row.status] = row._count;

    // 채점 큐가 오래 밀려있는 제출(=샌드박스/컴파일 인스턴스가 막혔을 가능성) 감지용.
    const oldestPending = await this.prisma.submission.findFirst({
      where: { status: { in: ['PENDING', 'JUDGING'] } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const oldestPendingAgeSec = oldestPending
      ? Math.floor((Date.now() - oldestPending.createdAt.getTime()) / 1000)
      : 0;

    return {
      users: { total: userCount, members: memberCount, banned: bannedCount },
      problems: {
        total: Object.values(byStatus).reduce((a, b) => a + b, 0),
        draft: byStatus.DRAFT ?? 0,
        pendingReview: byStatus.PENDING_REVIEW ?? 0,
        published: byStatus.PUBLISHED ?? 0,
        rejected: byStatus.REJECTED ?? 0,
      },
      submissions: {
        today: submissionsToday,
        total: submissionsTotal,
      },
      judgeHealth: {
        queueDepth: pendingJudging,
        oldestPendingAgeSec,
        internalErrorsLast24h: recentInternalErrors,
        compileErrorsLast24h: recentCompileErrors,
      },
    };
  }
}
