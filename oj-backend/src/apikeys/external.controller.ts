import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeyGuard } from './apikey.guard';
import { RequireScopes } from './require-scopes.decorator';

interface ExternalUserView {
  username: string;
  role: string;
  rating: number;
  solvedCount: number;
}

/**
 * 외부 서비스가 API 키로 계정 데이터를 조회하는 서비스간 엔드포인트.
 * 인증: 헤더 `x-api-key: ojk_...` 또는 `Authorization: ApiKey ojk_...`
 * 이 컨트롤러의 모든 엔드포인트는 'users:read' scope를 요구한다.
 *
 * 응답은 공개 프로필과 동일한 최소 필드만 내려준다(email/studentId/정지사유/가입일 등은 절대 포함하지 않는다).
 * API 키가 유출되더라도 개인정보 대량 유출로 이어지지 않도록 하기 위함.
 */
@UseGuards(ApiKeyGuard)
@RequireScopes('users:read')
// 키 하나가 짧은 시간에 전체 유저를 긁어가는 걸 막기 위한 최소한의 rate limit.
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('external/v1')
export class ExternalController {
  constructor(private readonly prisma: PrismaService) {}

  private async attachSolvedCounts<T extends { id: string }>(
    users: T[],
  ): Promise<Array<Omit<T, 'id'> & { solvedCount: number }>> {
    if (users.length === 0) return [];
    const rows = await this.prisma.$queryRaw<Array<{ userId: string; solvedCount: bigint }>>`
      SELECT "userId", COUNT(DISTINCT "problemId") AS "solvedCount"
      FROM submissions
      WHERE status = 'ACCEPTED' AND "userId" = ANY(${users.map((u) => u.id)})
      GROUP BY "userId"
    `;
    const counts = new Map(rows.map((r) => [r.userId, Number(r.solvedCount)]));
    return users.map(({ id, ...rest }) => ({ ...rest, solvedCount: counts.get(id) ?? 0 }));
  }

  @Get('users')
  async listUsers(@Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    const take = Math.min(Math.max(parseInt(limit ?? '50', 10) || 50, 1), 200);
    const users = await this.prisma.user.findMany({
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'asc' },
      select: { id: true, username: true, role: true, rating: true },
    });
    // nextCursor는 내부 페이지네이션 키(id)일 뿐이라 응답에 남겨도 되지만, 각 유저 레코드 자체에는 안 남긴다.
    const nextCursor = users.length === take ? users[users.length - 1].id : null;
    const view: ExternalUserView[] = await this.attachSolvedCounts(users);
    return { users: view, nextCursor };
  }

  @Get('users/:username')
  async getUser(@Param('username') username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, role: true, rating: true },
    });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    const [view] = await this.attachSolvedCounts([user]);
    return view;
  }
}
