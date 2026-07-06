import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContestDto, ContestProblemDto } from './dto/contest.dto';

function phaseOf(startsAt: Date, endsAt: Date, now = new Date()): 'UPCOMING' | 'RUNNING' | 'ENDED' {
  if (now < startsAt) return 'UPCOMING';
  if (now > endsAt) return 'ENDED';
  return 'RUNNING';
}

@Injectable()
export class ContestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(creatorId: string, dto: CreateContestDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) throw new BadRequestException('종료 시각은 시작 시각보다 뒤여야 합니다.');

    return this.prisma.contest.create({
      data: {
        title: dto.title,
        slug: dto.slug,
        description: dto.description ?? '',
        startsAt,
        endsAt,
        createdById: creatorId,
        problems: dto.problems
          ? {
              create: dto.problems.map((p, i) => ({
                problemId: p.problemId,
                label: p.label ?? String.fromCharCode(65 + i),
                order: i,
                points: p.points ?? 100,
              })),
            }
          : undefined,
      },
      include: { problems: true },
    });
  }

  async list() {
    const contests = await this.prisma.contest.findMany({
      orderBy: { startsAt: 'desc' },
      include: { _count: { select: { participants: true, problems: true } } },
    });
    return contests.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      phase: phaseOf(c.startsAt, c.endsAt),
      participantCount: c._count.participants,
      problemCount: c._count.problems,
    }));
  }

  async findBySlug(slug: string, userId?: string) {
    const contest = await this.prisma.contest.findUnique({
      where: { slug },
      include: {
        createdBy: { select: { username: true } },
        problems: {
          orderBy: { order: 'asc' },
          include: { problem: { select: { id: true, title: true, slug: true, difficulty: true, level: true } } },
        },
        _count: { select: { participants: true } },
      },
    });
    if (!contest) throw new NotFoundException('대회를 찾을 수 없습니다.');

    const phase = phaseOf(contest.startsAt, contest.endsAt);
    const registered = userId
      ? !!(await this.prisma.contestParticipant.findUnique({
          where: { contestId_userId: { contestId: contest.id, userId } },
        }))
      : false;

    // 시작 전에는 문제 목록을 감춘다.
    const problems =
      phase === 'UPCOMING'
        ? []
        : contest.problems.map((cp) => ({
            problemId: cp.problemId,
            label: cp.label,
            points: cp.points,
            title: cp.problem.title,
            slug: cp.problem.slug,
            difficulty: cp.problem.difficulty,
            level: cp.problem.level,
          }));

    return {
      id: contest.id,
      title: contest.title,
      slug: contest.slug,
      description: contest.description,
      startsAt: contest.startsAt,
      endsAt: contest.endsAt,
      phase,
      registered,
      participantCount: contest._count.participants,
      createdBy: contest.createdBy.username,
      problems,
    };
  }

  async register(contestId: string, userId: string) {
    const contest = await this.prisma.contest.findUnique({ where: { id: contestId } });
    if (!contest) throw new NotFoundException('대회를 찾을 수 없습니다.');
    if (phaseOf(contest.startsAt, contest.endsAt) === 'ENDED') {
      throw new BadRequestException('이미 종료된 대회입니다.');
    }
    await this.prisma.contestParticipant.upsert({
      where: { contestId_userId: { contestId, userId } },
      create: { contestId, userId },
      update: {},
    });
    return { registered: true };
  }

  async setProblems(contestId: string, problems: ContestProblemDto[]) {
    const contest = await this.prisma.contest.findUnique({ where: { id: contestId } });
    if (!contest) throw new NotFoundException('대회를 찾을 수 없습니다.');
    await this.prisma.contestProblem.deleteMany({ where: { contestId } });
    await this.prisma.contestProblem.createMany({
      data: problems.map((p, i) => ({
        contestId,
        problemId: p.problemId,
        label: p.label ?? String.fromCharCode(65 + i),
        order: i,
        points: p.points ?? 100,
      })),
    });
    return this.prisma.contestProblem.findMany({ where: { contestId }, orderBy: { order: 'asc' } });
  }

  /**
   * 리더보드: 대회 진행 시간 내 제출만 반영.
   * 각 참가자에 대해 문제별 첫 정답(AC) 시각을 찾아, 푼 문제 수 / 총 점수 / 소요 시간 합으로 순위를 낸다.
   */
  async leaderboard(slug: string) {
    const contest = await this.prisma.contest.findUnique({
      where: { slug },
      include: {
        problems: { orderBy: { order: 'asc' } },
        participants: { include: { user: { select: { id: true, username: true } } } },
      },
    });
    if (!contest) throw new NotFoundException('대회를 찾을 수 없습니다.');

    const problemPoints = new Map(contest.problems.map((cp) => [cp.problemId, cp.points]));
    const problemLabel = new Map(contest.problems.map((cp) => [cp.problemId, cp.label]));

    // 대회 창 내 정답 제출만 조회
    const acSubs = await this.prisma.submission.findMany({
      where: {
        contestId: contest.id,
        status: 'ACCEPTED',
        createdAt: { gte: contest.startsAt, lte: contest.endsAt },
      },
      select: { userId: true, problemId: true, createdAt: true },
    });

    // userId -> problemId -> 첫 AC 시각
    const firstAc = new Map<string, Map<string, Date>>();
    for (const s of acSubs) {
      if (!firstAc.has(s.userId)) firstAc.set(s.userId, new Map());
      const m = firstAc.get(s.userId)!;
      if (!m.has(s.problemId) || s.createdAt < m.get(s.problemId)!) m.set(s.problemId, s.createdAt);
    }

    const rows = contest.participants.map((p) => {
      const solvedMap = firstAc.get(p.userId) ?? new Map<string, Date>();
      const solved: Array<{ problemId: string; label: string; minutes: number }> = [];
      let score = 0;
      let totalMinutes = 0;
      for (const [problemId, at] of solvedMap) {
        if (!problemPoints.has(problemId)) continue; // 대회에서 제외된 문제 방어
        const minutes = Math.floor((at.getTime() - contest.startsAt.getTime()) / 60000);
        solved.push({ problemId, label: problemLabel.get(problemId) ?? '?', minutes });
        score += problemPoints.get(problemId)!;
        totalMinutes += minutes;
      }
      return {
        userId: p.userId,
        username: p.user.username,
        solvedCount: solved.length,
        score,
        totalMinutes,
        solved: solved.sort((a, b) => a.label.localeCompare(b.label)),
      };
    });

    rows.sort((a, b) => b.score - a.score || a.totalMinutes - b.totalMinutes);
    return rows.map((r, i) => ({ rank: i + 1, ...r }));
  }
}
