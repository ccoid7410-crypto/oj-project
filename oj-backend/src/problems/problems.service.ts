import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { CreateTestCaseDto, UpdateTestCaseDto } from './dto/testcase.dto';
import { clampLevel, labelOfLevel, tierOfLevel } from '../common/difficulty';
import { NotificationsService } from '../notifications/notifications.service';
import { RatingService } from '../rating/rating.service';
import { JUDGE_QUEUE, JudgeJobData } from '../judge/judge.constants';

// 투표 난이도가 현재 공식 난이도와 이 값 이상 벌어지면(약 1.5~2티어) 관리자에게 알린다.
const DIFFICULTY_ALERT_THRESHOLD = 8;

// 검증 제출이 채점되길 기다리는 최대 시간/폴링 간격.
const VERIFICATION_TIMEOUT_MS = 30_000;
const VERIFICATION_POLL_MS = 500;

const VERDICT_LABEL: Record<string, string> = {
  ACCEPTED: '맞았습니다',
  WRONG_ANSWER: '틀렸습니다',
  TIME_LIMIT_EXCEEDED: '시간 초과',
  MEMORY_LIMIT_EXCEEDED: '메모리 초과',
  RUNTIME_ERROR: '런타임 에러',
  COMPILE_ERROR: '컴파일 에러',
  INTERNAL_ERROR: '채점 서버 오류',
};

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
    private readonly rating: RatingService,
    @InjectQueue(JUDGE_QUEUE) private readonly judgeQueue: Queue<JudgeJobData>,
  ) {}

  /**
   * 문제가 막 공개(PUBLISHED)됐을 때, 그 문제에 이미 AC 제출이 있는 사용자들(주로 작성자 본인의
   * 검증용 제출)의 레이팅을 다시 계산한다. 레이팅은 PUBLISHED된 문제만 반영하므로, 공개되기 전엔
   * 반영되지 않았다가 이 시점에 비로소 잡힌다.
   */
  private async recomputeRatingForPublishedProblem(problemId: string) {
    const solvers = await this.prisma.submission.findMany({
      where: { problemId, status: 'ACCEPTED' },
      distinct: ['userId'],
      select: { userId: true },
    });
    for (const s of solvers) {
      await this.rating.recomputeForUser(s.userId);
    }
  }

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
    // 대회 전용 지정은 어드민만 가능(일반 사용자 dto는 무시).
    const contestOnly = authorRole === 'ADMIN' && !!dto.contestOnly;
    const tags = dto.tags ?? [];
    if (contestOnly && !tags.includes('대회전용')) tags.push('대회전용');

    const isAdmin = authorRole === 'ADMIN';
    if (!isAdmin) {
      // 문제 등록은 동아리 부원(MEMBER) 이상만 가능하다. 일반(USER) 계정은 풀이만 할 수 있다.
      if (authorRole !== 'MEMBER') {
        throw new ForbiddenException('동아리 부원만 문제를 등록할 수 있습니다.');
      }
      if (!dto.testCases || dto.testCases.length === 0) {
        throw new BadRequestException('테스트케이스를 최소 1개 이상 넣어야 합니다.');
      }
      if (!dto.verificationLanguage || !dto.verificationCode) {
        throw new BadRequestException('제안하는 문제는 그 문제를 실제로 푸는 코드를 같이 제출해서 검증해야 합니다.');
      }
    }

    // test 태그 문제는 1~1000번대를 쓴다 (관리자 전용 점검 문제). 일반 문제는 시퀀스가 1001부터 부여.
    let testDisplayId: number | undefined;
    if (tags.includes('test')) {
      const maxTest = await this.prisma.problem.aggregate({
        _max: { displayId: true },
        where: { displayId: { lte: 1000 } },
      });
      testDisplayId = (maxTest._max.displayId ?? 0) + 1;
      if (testDisplayId > 1000) {
        throw new BadRequestException('test 문제 번호(1~1000)가 모두 사용되었습니다.');
      }
    }

    const problem = await this.prisma.problem.create({
      data: {
        ...(testDisplayId !== undefined ? { displayId: testDisplayId } : {}),
        title: dto.title,
        slug: dto.slug,
        description: dto.description,
        difficulty: tierOfLevel(level) as any,
        level,
        timeLimitMs: dto.timeLimitMs,
        memoryLimitMb: dto.memoryLimitMb,
        allowedLanguages: (dto.allowedLanguages ?? []) as any,
        tags,
        contestOnly,
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

    if (!isAdmin) {
      await this.verifyWithSolution(problem.id, authorId, dto.verificationLanguage!, dto.verificationCode!);
    }

    return problem;
  }

  /**
   * 일반 사용자가 제안한 문제는 반드시 "실제로 그 문제를 통과하는 코드"를 같이 내야 한다.
   * 검증 제출을 채점 큐에 넣고 끝날 때까지 기다린 뒤, ACCEPTED가 아니면 방금 만든 문제를
   * (테스트케이스까지 cascade로) 롤백하고 실패 사유를 알려준다.
   */
  private async verifyWithSolution(problemId: string, authorId: string, language: string, sourceCode: string) {
    const submission = await this.prisma.submission.create({
      data: { userId: authorId, problemId, language: language as any, sourceCode, status: 'PENDING' },
    });
    await this.judgeQueue.add(
      'judge',
      { submissionId: submission.id },
      { attempts: 1, removeOnComplete: 1000, removeOnFail: 1000 },
    );

    const deadline = Date.now() + VERIFICATION_TIMEOUT_MS;
    let finalStatus = submission.status;
    while (Date.now() < deadline) {
      const current = await this.prisma.submission.findUnique({
        where: { id: submission.id },
        select: { status: true },
      });
      finalStatus = current?.status ?? finalStatus;
      if (finalStatus !== 'PENDING' && finalStatus !== 'JUDGING') break;
      await new Promise((resolve) => setTimeout(resolve, VERIFICATION_POLL_MS));
    }

    if (finalStatus === 'ACCEPTED') return;

    // 실패(또는 타임아웃): 문제 자체를 없던 일로 되돌린다.
    // Submission.problem엔 onDelete cascade가 없어서(제출 기록 보존 목적), 검증용 제출부터 먼저 지워야
    // 문제 삭제가 외래키 위반 없이 된다(테스트케이스 등 나머지는 Problem 삭제에 cascade로 같이 지워짐).
    await this.prisma.submission.delete({ where: { id: submission.id } }).catch(() => undefined);
    await this.prisma.problem.delete({ where: { id: problemId } });

    if (finalStatus === 'PENDING' || finalStatus === 'JUDGING') {
      throw new BadRequestException('채점이 너무 오래 걸려서 검증에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
    throw new BadRequestException(
      `제출한 코드가 검증에 실패했습니다 (${VERDICT_LABEL[finalStatus] ?? finalStatus}). 코드와 테스트케이스를 확인해주세요.`,
    );
  }

  /** 대회 전용 문제가 이제 공개 목록에 나와도 되는지: 종료 + problemsVisibleAfterEnd인 대회에 하나라도 걸려있으면 공개. */
  private contestOnlyVisibleFilter() {
    return {
      contestProblems: {
        some: { contest: { endsAt: { lt: new Date() }, problemsVisibleAfterEnd: true } },
      },
    };
  }

  async findAllPublished(userId?: string, requesterRole?: string) {
    const problems = await this.prisma.problem.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [{ contestOnly: false }, { contestOnly: true, ...this.contestOnlyVisibleFilter() }],
        // test 태그 문제(채점기 점검용, 1~1000번대)는 관리자에게만 보인다
        ...(requesterRole !== 'ADMIN' ? { NOT: { tags: { has: 'test' } } } : {}),
      },
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

    // 로그인한 사용자의 문제별 상태: 한 번이라도 맞았으면 solved, 제출은 했지만 못 맞췄으면 attempted
    const myStatus = new Map<string, 'solved' | 'attempted'>();
    if (userId && problems.length > 0) {
      const ids = problems.map((p) => p.id);
      const [attempted, solved] = await Promise.all([
        this.prisma.submission.findMany({
          where: { userId, problemId: { in: ids } },
          select: { problemId: true },
          distinct: ['problemId'],
        }),
        this.prisma.submission.findMany({
          where: { userId, problemId: { in: ids }, status: 'ACCEPTED' },
          select: { problemId: true },
          distinct: ['problemId'],
        }),
      ]);
      for (const s of attempted) myStatus.set(s.problemId, 'attempted');
      for (const s of solved) myStatus.set(s.problemId, 'solved');
    }

    return problems.map((p) => ({
      ...p,
      ...(stats.get(p.id) ?? this.emptyStats()),
      myStatus: myStatus.get(p.id) ?? null,
    }));
  }

  /** 어드민: 상태 무관 전체 문제 목록(관리/삭제용). */
  async findAllForAdmin() {
    return this.prisma.problem.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        displayId: true,
        title: true,
        slug: true,
        status: true,
        contestOnly: true,
        createdAt: true,
        author: { select: { username: true } },
      },
    });
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
    const updated = await this.prisma.problem.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        isPublished: true,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewNote: null,
      },
    });
    await this.recomputeRatingForPublishedProblem(id);
    return updated;
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
  async findBySlug(slug: string, requesterId?: string, requesterRole?: string, contestId?: string) {
    const problem = await this.prisma.problem.findUnique({
      where: { slug },
      include: {
        testCases: { where: { isSample: true }, orderBy: { order: 'asc' } },
      },
    });
    if (!problem) throw new NotFoundException('문제를 찾을 수 없습니다.');

    const isAdmin = requesterRole === 'ADMIN';
    const isAuthor = requesterId === problem.authorId;

    // 아직 공개 안 된 문제(초안/검토중/반려)는 작성자/어드민만 볼 수 있다.
    if (problem.status !== 'PUBLISHED' && !isAdmin && !isAuthor) {
      throw new NotFoundException('문제를 찾을 수 없습니다.');
    }

    // test 태그 문제(채점기 점검용)는 관리자/작성자만 볼 수 있다.
    if (problem.tags.includes('test') && !isAdmin && !isAuthor) {
      throw new NotFoundException('문제를 찾을 수 없습니다.');
    }

    // 대회 전용 문제는 공개 전환되기 전까지 대회 참가자(제출 화면에서 contestId를 넘긴 경우)만 볼 수 있다.
    if (problem.contestOnly && !isAdmin && !isAuthor) {
      const publiclyVisible = await this.prisma.problem.count({
        where: { id: problem.id, ...this.contestOnlyVisibleFilter() },
      });
      if (!publiclyVisible) {
        let isContestParticipant = false;
        if (contestId && requesterId) {
          const cp = await this.prisma.contestProblem.findUnique({
            where: { contestId_problemId: { contestId, problemId: problem.id } },
          });
          if (cp) {
            const participant = await this.prisma.contestParticipant.findUnique({
              where: { contestId_userId: { contestId, userId: requesterId } },
            });
            isContestParticipant = !!participant;
          }
        }
        if (!isContestParticipant) throw new NotFoundException('문제를 찾을 수 없습니다.');
      }
    }

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

    // 내 정답/오답 상태: 맞은 적 있으면 solved(=canVote와 같은 조건), 제출만 했으면 attempted
    let myStatus: 'solved' | 'attempted' | null = null;
    if (requesterId) {
      if (canVote) {
        myStatus = 'solved';
      } else {
        const attempted = await this.prisma.submission.count({
          where: { problemId: problem.id, userId: requesterId },
        });
        if (attempted > 0) myStatus = 'attempted';
      }
    }

    return {
      ...problem,
      ...(stats.get(problem.id) ?? this.emptyStats()),
      difficultyVoteCount: voteAgg._count,
      difficultyVoteAverage: voteAgg._avg.level != null ? Math.round(voteAgg._avg.level * 10) / 10 : null,
      myDifficultyVote: myVote?.level ?? null,
      canVoteDifficulty: canVote,
      myStatus,
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
    const updated = await this.prisma.problem.update({
      where: { id },
      data: { isPublished: true, status: 'PUBLISHED' },
    });
    await this.recomputeRatingForPublishedProblem(id);
    return updated;
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

  /** 작성자/어드민만 테스트케이스를 관리할 수 있다(문제 존재 확인 겸 권한 체크). */
  private async assertCanManageTestCases(problemId: string, requesterId: string, requesterRole: string) {
    const problem = await this.prisma.problem.findUnique({ where: { id: problemId } });
    if (!problem) throw new NotFoundException('문제를 찾을 수 없습니다.');
    if (problem.authorId !== requesterId && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('이 문제의 테스트케이스를 관리할 권한이 없습니다.');
    }
    return problem;
  }

  /** 작성자/어드민: 테스트케이스 전체 목록(히든 포함) 조회. */
  async listTestCases(problemId: string, requesterId: string, requesterRole: string) {
    await this.assertCanManageTestCases(problemId, requesterId, requesterRole);
    return this.prisma.testCase.findMany({ where: { problemId }, orderBy: { order: 'asc' } });
  }

  /** 작성자/어드민: 테스트케이스 추가(맨 뒤에 붙는다). */
  async addTestCase(problemId: string, requesterId: string, requesterRole: string, dto: CreateTestCaseDto) {
    await this.assertCanManageTestCases(problemId, requesterId, requesterRole);
    const count = await this.prisma.testCase.count({ where: { problemId } });
    return this.prisma.testCase.create({
      data: {
        problemId,
        input: dto.input,
        output: dto.output,
        isSample: dto.isSample ?? false,
        order: count,
      },
    });
  }

  /** 작성자/어드민: 여러 테스트케이스를 한 번에 추가(zip 업로드용). 모두 맨 뒤에 순서대로 붙는다. */
  async bulkAddTestCases(
    problemId: string,
    requesterId: string,
    requesterRole: string,
    testCases: CreateTestCaseDto[],
  ) {
    await this.assertCanManageTestCases(problemId, requesterId, requesterRole);
    const count = await this.prisma.testCase.count({ where: { problemId } });
    // 하나라도 실패하면 전부 롤백해서, 절반만 추가된 애매한 상태가 남지 않게 한다.
    await this.prisma.testCase.createMany({
      data: testCases.map((tc, idx) => ({
        problemId,
        input: tc.input,
        output: tc.output,
        isSample: tc.isSample ?? false,
        order: count + idx,
      })),
    });
    return { addedCount: testCases.length };
  }

  /**
   * 작성자/어드민: 테스트케이스 전체를 주어진 목록으로 맞춘다(수정 페이지 통합 편집용).
   * - id가 있는 항목은 내용/샘플여부/순서를 업데이트한다(제출 기록 유지).
   * - id가 없는 항목은 새로 만든다.
   * - 목록에 없는 기존 케이스는 삭제한다.
   * 순서는 배열 인덱스를 따른다. 전부 한 트랜잭션으로 처리해 중간 실패 시 롤백된다.
   */
  async syncTestCases(
    problemId: string,
    requesterId: string,
    requesterRole: string,
    items: Array<{ id?: string; input: string; output: string; isSample?: boolean }>,
  ) {
    await this.assertCanManageTestCases(problemId, requesterId, requesterRole);
    const existing = await this.prisma.testCase.findMany({
      where: { problemId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((t) => t.id));
    const keepIds = new Set(items.filter((i) => i.id).map((i) => i.id!));

    // 목록에 없는 id를 클라이언트가 보냈다면(다른 문제 것이거나 이미 삭제됨) 막는다.
    for (const id of keepIds) {
      if (!existingIds.has(id)) {
        throw new NotFoundException('존재하지 않는 테스트케이스가 포함돼 있습니다.');
      }
    }

    const toDelete = [...existingIds].filter((id) => !keepIds.has(id));

    await this.prisma.$transaction([
      ...(toDelete.length ? [this.prisma.testCase.deleteMany({ where: { id: { in: toDelete } } })] : []),
      ...items.map((item, idx) =>
        item.id
          ? this.prisma.testCase.update({
              where: { id: item.id },
              data: { input: item.input, output: item.output, isSample: item.isSample ?? false, order: idx },
            })
          : this.prisma.testCase.create({
              data: {
                problemId,
                input: item.input,
                output: item.output,
                isSample: item.isSample ?? false,
                order: idx,
              },
            }),
      ),
    ]);

    return this.prisma.testCase.findMany({ where: { problemId }, orderBy: { order: 'asc' } });
  }

  /** 작성자/어드민: 테스트케이스 수정. */
  async updateTestCase(
    problemId: string,
    testCaseId: string,
    requesterId: string,
    requesterRole: string,
    dto: UpdateTestCaseDto,
  ) {
    await this.assertCanManageTestCases(problemId, requesterId, requesterRole);
    const tc = await this.prisma.testCase.findUnique({ where: { id: testCaseId } });
    if (!tc || tc.problemId !== problemId) throw new NotFoundException('테스트케이스를 찾을 수 없습니다.');
    return this.prisma.testCase.update({ where: { id: testCaseId }, data: dto });
  }

  /** 작성자/어드민: 테스트케이스 삭제. */
  async deleteTestCase(problemId: string, testCaseId: string, requesterId: string, requesterRole: string) {
    await this.assertCanManageTestCases(problemId, requesterId, requesterRole);
    const tc = await this.prisma.testCase.findUnique({ where: { id: testCaseId } });
    if (!tc || tc.problemId !== problemId) throw new NotFoundException('테스트케이스를 찾을 수 없습니다.');
    await this.prisma.testCase.delete({ where: { id: testCaseId } });
    return { success: true };
  }

  // ---- 문제 Q&A 게시판 ----

  async listComments(problemId: string) {
    return this.prisma.problemComment.findMany({
      where: { problemId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { username: true } } },
    });
  }

  async addComment(problemId: string, userId: string, content: string, parentId?: string) {
    const problem = await this.prisma.problem.findUnique({ where: { id: problemId } });
    if (!problem) throw new NotFoundException('문제를 찾을 수 없습니다.');
    if (parentId) {
      const parent = await this.prisma.problemComment.findUnique({ where: { id: parentId } });
      if (!parent || parent.problemId !== problemId) throw new NotFoundException('답글 대상을 찾을 수 없습니다.');
    }
    return this.prisma.problemComment.create({
      data: { problemId, userId, content, parentId },
      include: { user: { select: { username: true } } },
    });
  }

  async removeComment(commentId: string, requesterId: string, requesterRole: string) {
    const comment = await this.prisma.problemComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('댓글을 찾을 수 없습니다.');
    if (comment.userId !== requesterId && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('이 댓글을 삭제할 권한이 없습니다.');
    }
    await this.prisma.problemComment.delete({ where: { id: commentId } });
    return { success: true };
  }
}
