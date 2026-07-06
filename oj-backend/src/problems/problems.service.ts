import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { clampLevel, labelOfLevel, tierOfLevel } from '../common/difficulty';
import { NotificationsService } from '../notifications/notifications.service';

// 투표 난이도가 현재 공식 난이도와 이 값 이상 벌어지면(약 1.5~2티어) 관리자에게 알린다.
const DIFFICULTY_ALERT_THRESHOLD = 8;

// difficulty만 주어졌을 때(level 생략) 쓰는 굵은 티어 → 대표 level 매핑 (하위호환용)
const MID_LEVEL_OF_TIER: Record<string, number> = {
  BRONZE: 3,
  SILVER: 8,
  GOLD: 13,
  PLATINUM: 18,
  DIAMOND: 23,
  RUBY: 28,
};

interface ProblemStats {
  submissionCount: number;
  acceptedCount: number;
  solvedCount: number;
  accuracy: number; // 0~100, 소수 둘째자리
}

@Injectable()
export class ProblemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** BOJ의 "제출/맞힌 사람/정답 비율" 컬럼용 통계. 문제별로 실제 제출 기록을 집계한다. */
  private async getStats(problemIds: string[]): Promise<Map<string, ProblemStats>> {
    const stats = new Map<string, ProblemStats>();
    if (problemIds.length === 0) return stats;

    const rows = await this.prisma.$queryRaw<
      Array<{ problemId: string; submissionCount: bigint; acceptedCount: bigint; solvedCount: bigint }>
    >`
      SELECT
        s."problemId" AS "problemId",
        COUNT(*) AS "submissionCount",
        COUNT(*) FILTER (WHERE s.status = 'ACCEPTED') AS "acceptedCount",
        COUNT(DISTINCT s."userId") FILTER (WHERE s.status = 'ACCEPTED') AS "solvedCount"
      FROM submissions s
      WHERE s."problemId" = ANY(${problemIds})
      GROUP BY s."problemId"
    `;

    for (const row of rows) {
      const submissionCount = Number(row.submissionCount);
      const acceptedCount = Number(row.acceptedCount);
      const solvedCount = Number(row.solvedCount);
      stats.set(row.problemId, {
        submissionCount,
        acceptedCount,
        solvedCount,
        accuracy: submissionCount > 0 ? Math.round((acceptedCount / submissionCount) * 10000) / 100 : 0,
      });
    }
    return stats;
  }

  private emptyStats(): ProblemStats {
    return { submissionCount: 0, acceptedCount: 0, solvedCount: 0, accuracy: 0 };
  }

  async create(authorId: string, authorRole: string, dto: CreateProblemDto) {
    // 일반 사용자가 만든 문제는 곧바로 어드민 승인 대기(PENDING_REVIEW)로 들어간다.
    // 어드민이 만든 문제는 초안(DRAFT) 상태로 두고, 이후 직접 공개할 수 있다.
    const status = authorRole === 'ADMIN' ? 'DRAFT' : 'PENDING_REVIEW';
    const level = dto.level != null ? clampLevel(dto.level) : (dto.difficulty ? MID_LEVEL_OF_TIER[dto.difficulty] : 1);
    return this.prisma.problem.create({
      data: {
        title: dto.title,
        slug: dto.slug,
        description: dto.description,
        difficulty: tierOfLevel(level) as any,
        level,
        timeLimitMs: dto.timeLimitMs,
        memoryLimitMb: dto.memoryLimitMb,
        allowedLanguages: (dto.allowedLanguages ?? []) as any,
        tags: dto.tags ?? [],
        authorId,
        status: status as any,
        testCases: dto.testCases
          ? {
              create: dto.testCases.map((tc, idx) => ({
                input: tc.input,
                output: tc.output,
                isSample: tc.isSample ?? false,
                order: idx,
              })),
            }
          : undefined,
      },
      include: { testCases: true },
    });
  }

  async findAllPublished() {
    const problems = await this.prisma.problem.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true,
        displayId: true,
        title: true,
        slug: true,
        difficulty: true,
        level: true,
        tags: true,
        createdAt: true,
      },
      orderBy: { displayId: 'asc' },
    });
    const stats = await this.getStats(problems.map((p) => p.id));
    return problems.map((p) => ({ ...p, ...(stats.get(p.id) ?? this.emptyStats()) }));
  }

  /** 어드민: 승인 대기(제안된) 문제 목록. */
  async findProposals() {
    return this.prisma.problem.findMany({
      where: { status: 'PENDING_REVIEW' },
      select: {
        id: true,
        displayId: true,
        title: true,
        slug: true,
        difficulty: true,
        level: true,
        tags: true,
        createdAt: true,
        author: { select: { username: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** 로그인 사용자: 내가 만든 문제 목록(상태 포함). */
  async findMine(authorId: string) {
    return this.prisma.problem.findMany({
      where: { authorId },
      select: {
        id: true,
        displayId: true,
        title: true,
        slug: true,
        difficulty: true,
        level: true,
        status: true,
        reviewNote: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 작성자: 초안/반려 상태의 문제를 승인 대기로 제출. */
  async submitForReview(id: string, requesterId: string, requesterRole: string) {
    const problem = await this.prisma.problem.findUnique({ where: { id } });
    if (!problem) throw new NotFoundException('문제를 찾을 수 없습니다.');
    if (problem.authorId !== requesterId && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('이 문제를 제출할 권한이 없습니다.');
    }
    return this.prisma.problem.update({
      where: { id },
      data: { status: 'PENDING_REVIEW', reviewNote: null },
    });
  }

  /** 어드민: 승인 → 공개. */
  async approve(id: string, reviewerId: string) {
    const problem = await this.prisma.problem.findUnique({ where: { id } });
    if (!problem) throw new NotFoundException('문제를 찾을 수 없습니다.');
    return this.prisma.problem.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        isPublished: true,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: null,
      },
    });
  }

  /** 어드민: 반려(사유 포함). */
  async reject(id: string, reviewerId: string, note: string) {
    const problem = await this.prisma.problem.findUnique({ where: { id } });
    if (!problem) throw new NotFoundException('문제를 찾을 수 없습니다.');
    return this.prisma.problem.update({
      where: { id },
      data: {
        status: 'REJECTED',
        isPublished: false,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: note ?? null,
      },
    });
  }

  /** 문제 상세 조회. 샘플 테스트케이스만 노출 (히든은 채점 워커만 사용) */
  async findBySlug(slug: string, requesterId?: string) {
    const problem = await this.prisma.problem.findUnique({
      where: { slug },
      include: {
        testCases: { where: { isSample: true }, orderBy: { order: 'asc' } },
      },
    });
    if (!problem) throw new NotFoundException('문제를 찾을 수 없습니다.');
    const stats = await this.getStats([problem.id]);

    const voteAgg = await this.prisma.problemDifficultyVote.aggregate({
      where: { problemId: problem.id },
      _avg: { level: true },
      _count: true,
    });
    const myVote = requesterId
      ? await this.prisma.problemDifficultyVote.findUnique({
          where: { problemId_userId: { problemId: problem.id, userId: requesterId } },
        })
      : null;
    const canVote = requesterId
      ? (await this.prisma.submission.count({
          where: { problemId: problem.id, userId: requesterId, status: 'ACCEPTED' },
        })) > 0
      : false;

    return {
      ...problem,
      ...(stats.get(problem.id) ?? this.emptyStats()),
      difficultyVoteCount: voteAgg._count,
      difficultyVoteAverage: voteAgg._avg.level != null ? Math.round(voteAgg._avg.level * 10) / 10 : null,
      myDifficultyVote: myVote?.level ?? null,
      canVoteDifficulty: canVote,
    };
  }

  /** 문제를 실제로 푼(ACCEPTED) 사용자만 체감 난이도에 투표할 수 있다. */
  async voteDifficulty(problemId: string, userId: string, level: number) {
    const solved = await this.prisma.submission.count({
      where: { problemId, userId, status: 'ACCEPTED' },
    });
    if (solved === 0) {
      throw new ForbiddenException('이 문제를 정답으로 통과해야 난이도에 투표할 수 있습니다.');
    }
    const problem = await this.prisma.problem.findUnique({ where: { id: problemId } });
    if (!problem) throw new NotFoundException('문제를 찾을 수 없습니다.');

    const clamped = clampLevel(level);
    await this.prisma.problemDifficultyVote.upsert({
      where: { problemId_userId: { problemId, userId } },
      create: { problemId, userId, level: clamped },
      update: { level: clamped },
    });

    // 공식 난이도와 크게 어긋나는 투표는 관리자에게 알린다 (레이팅 배점에 영향을 줄 수 있는 사건이라서).
    const deviation = Math.abs(clamped - problem.level);
    if (deviation >= DIFFICULTY_ALERT_THRESHOLD) {
      const voter = await this.prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
      await this.notifications.create({
        type: 'DIFFICULTY_VOTE_SPIKE',
        message: `${voter?.username ?? '(알 수 없음)'}님이 "${problem.title}"(현재 ${labelOfLevel(problem.level)})를 ${labelOfLevel(clamped)}로 투표했습니다 (편차 ${deviation}단계).`,
        problemId,
        voterId: userId,
      });
    }

    const voteAgg = await this.prisma.problemDifficultyVote.aggregate({
      where: { problemId },
      _avg: { level: true },
      _count: true,
    });
    return {
      myDifficultyVote: clamped,
      difficultyVoteCount: voteAgg._count,
      difficultyVoteAverage: voteAgg._avg.level != null ? Math.round(voteAgg._avg.level * 10) / 10 : null,
    };
  }

  /** 어드민: 커뮤니티 투표 평균을 공식 난이도로 반영. */
  async applyCommunityDifficulty(problemId: string) {
    const voteAgg = await this.prisma.problemDifficultyVote.aggregate({
      where: { problemId },
      _avg: { level: true },
      _count: true,
    });
    if (!voteAgg._avg.level) {
      throw new BadRequestException('아직 난이도 투표가 없습니다.');
    }
    const level = clampLevel(voteAgg._avg.level);
    return this.prisma.problem.update({
      where: { id: problemId },
      data: { level, difficulty: tierOfLevel(level) as any },
    });
  }

  async update(id: string, requesterId: string, requesterRole: string, dto: UpdateProblemDto) {
    const problem = await this.prisma.problem.findUnique({ where: { id } });
    if (!problem) throw new NotFoundException('문제를 찾을 수 없습니다.');
    if (problem.authorId !== requesterId && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('이 문제를 수정할 권한이 없습니다.');
    }
    const level = dto.level != null ? clampLevel(dto.level) : undefined;
    return this.prisma.problem.update({
      where: { id },
      data: {
        ...dto,
        ...(level != null ? { level, difficulty: tierOfLevel(level) as any } : { difficulty: dto.difficulty as any }),
      },
    });
  }

  async publish(id: string) {
    return this.prisma.problem.update({
      where: { id },
      data: { isPublished: true, status: 'PUBLISHED' },
    });
  }

  async remove(id: string, requesterId: string, requesterRole: string) {
    const problem = await this.prisma.problem.findUnique({ where: { id } });
    if (!problem) throw new NotFoundException('문제를 찾을 수 없습니다.');
    if (problem.authorId !== requesterId && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('이 문제를 삭제할 권한이 없습니다.');
    }
    await this.prisma.problem.delete({ where: { id } });
    return { success: true };
  }

  /** 채점 워커 전용: 전체(히든 포함) 테스트케이스 조회 */
  async getAllTestCasesForJudge(problemId: string) {
    return this.prisma.testCase.findMany({
      where: { problemId },
      orderBy: { order: 'asc' },
    });
  }
}
