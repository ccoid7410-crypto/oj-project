import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll() {
    const classes = await this.prisma.classRoom.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true, problems: true } } },
    });
    return classes.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      memberCount: c._count.members,
      problemCount: c._count.problems,
      createdAt: c.createdAt,
    }));
  }

  /** 로그인한 사용자가 속한 수업 목록. */
  async listMine(userId: string) {
    const memberships = await this.prisma.classMembership.findMany({
      where: { userId },
      include: { class: { include: { _count: { select: { members: true, problems: true } } } } },
    });
    return memberships.map((m) => ({
      id: m.class.id,
      name: m.class.name,
      slug: m.class.slug,
      description: m.class.description,
      memberCount: m.class._count.members,
      problemCount: m.class._count.problems,
    }));
  }

  async create(creatorId: string, name: string, slug: string, description?: string) {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new BadRequestException('slug은 영문 소문자/숫자/하이픈만 가능합니다.');
    const exists = await this.prisma.classRoom.findUnique({ where: { slug } });
    if (exists) throw new ConflictException('이미 있는 slug입니다.');
    return this.prisma.classRoom.create({
      data: { name, slug, description: description ?? '', createdById: creatorId },
    });
  }

  async remove(id: string) {
    const cls = await this.prisma.classRoom.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('수업을 찾을 수 없습니다.');
    await this.prisma.classRoom.delete({ where: { id } });
    return { success: true };
  }

  private async assertMember(classId: string, userId: string, role: string) {
    if (role === 'ADMIN') return;
    const m = await this.prisma.classMembership.findUnique({
      where: { classId_userId: { classId, userId } },
    });
    if (!m) throw new ForbiddenException('이 수업에 속해있지 않습니다.');
  }

  async addMember(classId: string, userId: string) {
    const cls = await this.prisma.classRoom.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('수업을 찾을 수 없습니다.');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    await this.prisma.classMembership.upsert({
      where: { classId_userId: { classId, userId } },
      create: { classId, userId },
      update: {},
    });
    return { success: true };
  }

  async removeMember(classId: string, userId: string) {
    await this.prisma.classMembership
      .delete({ where: { classId_userId: { classId, userId } } })
      .catch(() => {
        throw new NotFoundException('이 수업의 멤버가 아닙니다.');
      });
    return { success: true };
  }

  async listMembers(classId: string) {
    const memberships = await this.prisma.classMembership.findMany({
      where: { classId },
      include: { user: { select: { id: true, username: true, email: true, rating: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return memberships.map((m) => m.user);
  }

  async setProblems(classId: string, problemIds: string[]) {
    const cls = await this.prisma.classRoom.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('수업을 찾을 수 없습니다.');
    await this.prisma.$transaction([
      this.prisma.classProblem.deleteMany({ where: { classId } }),
      this.prisma.classProblem.createMany({
        data: problemIds.map((problemId, order) => ({ classId, problemId, order })),
      }),
    ]);
    return { success: true };
  }

  async addNotice(classId: string, authorId: string, title: string, content: string) {
    const cls = await this.prisma.classRoom.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('수업을 찾을 수 없습니다.');
    return this.prisma.classNotice.create({
      data: { classId, title, content, createdById: authorId },
    });
  }

  async removeNotice(noticeId: string) {
    await this.prisma.classNotice.delete({ where: { id: noticeId } }).catch(() => {
      throw new NotFoundException('공지를 찾을 수 없습니다.');
    });
    return { success: true };
  }

  /** 멤버(또는 어드민)만 상세 조회 가능: 문제집, 공지, 랭킹을 함께 내려준다. */
  async getDetail(slug: string, requesterId: string, requesterRole: string) {
    const cls = await this.prisma.classRoom.findUnique({
      where: { slug },
      include: {
        problems: {
          orderBy: { order: 'asc' },
          include: { problem: { select: { id: true, displayId: true, title: true, slug: true, difficulty: true, level: true } } },
        },
        notices: { orderBy: { createdAt: 'desc' } },
        members: { include: { user: { select: { id: true, username: true, rating: true } } } },
      },
    });
    if (!cls) throw new NotFoundException('수업을 찾을 수 없습니다.');
    await this.assertMember(cls.id, requesterId, requesterRole);

    const problemIds = cls.problems.map((p) => p.problemId);
    const memberIds = cls.members.map((m) => m.userId);

    const acSubs = problemIds.length
      ? await this.prisma.submission.findMany({
          where: { userId: { in: memberIds }, problemId: { in: problemIds }, status: 'ACCEPTED' },
          select: { userId: true, problemId: true },
          distinct: ['userId', 'problemId'],
        })
      : [];
    const solvedCountByUser = new Map<string, number>();
    for (const s of acSubs) {
      solvedCountByUser.set(s.userId, (solvedCountByUser.get(s.userId) ?? 0) + 1);
    }

    const ranking = cls.members
      .map((m) => ({
        userId: m.userId,
        username: m.user.username,
        rating: m.user.rating,
        solvedCount: solvedCountByUser.get(m.userId) ?? 0,
      }))
      .sort((a, b) => b.solvedCount - a.solvedCount || a.username.localeCompare(b.username));

    return {
      id: cls.id,
      name: cls.name,
      slug: cls.slug,
      description: cls.description,
      problems: cls.problems.map((p) => ({ order: p.order, ...p.problem })),
      notices: cls.notices,
      ranking,
    };
  }
}
