import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { pointsOfLevel } from '../common/difficulty';

/**
 * 유저 레이팅 = "상위 100문제(AC 기준) 레이팅 합".
 * 즉 그 유저가 정답 처리받은 문제들 중 배점이 높은 순으로 100개를 골라 그 배점을 합산한다.
 * PrismaService만 있으면 되므로 API 서버/채점 워커 양쪽에서 재사용한다.
 */
@Injectable()
export class RatingService {
  private readonly logger = new Logger(RatingService.name);
  private static readonly TOP_N = 100;

  constructor(private readonly prisma: PrismaService) {}

  /** 유저가 처음으로 AC를 받은 문제인지 확인(레이팅 재계산이 필요한 이벤트인지 판단용). */
  async isFirstAccept(userId: string, problemId: string): Promise<boolean> {
    const count = await this.prisma.submission.count({
      where: { userId, problemId, status: 'ACCEPTED' },
    });
    return count <= 1;
  }

  async recomputeForUser(userId: string): Promise<number> {
    const solved = await this.prisma.submission.findMany({
      where: { userId, status: 'ACCEPTED' },
      distinct: ['problemId'],
      select: { problem: { select: { level: true } } },
    });

    const points = solved
      .map((s) => pointsOfLevel(s.problem.level))
      .sort((a, b) => b - a)
      .slice(0, RatingService.TOP_N);

    const rating = points.reduce((sum, p) => sum + p, 0);
    await this.prisma.user.update({ where: { id: userId }, data: { rating } });
    return rating;
  }

  /** 운영 도구용: 전체 유저 레이팅을 실제 제출 기록 기준으로 다시 계산한다. */
  async recomputeAll(): Promise<number> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const u of users) {
      await this.recomputeForUser(u.id);
    }
    this.logger.log(`레이팅 전체 재계산 완료: ${users.length}명`);
    return users.length;
  }
}
