import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const groups = await this.prisma.group.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true } } },
    });
    return groups.map((g) => ({ id: g.id, name: g.name, createdAt: g.createdAt, memberCount: g._count.members }));
  }

  async create(name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('그룹 이름을 입력하세요.');
    const exists = await this.prisma.group.findUnique({ where: { name: trimmed } });
    if (exists) throw new ConflictException('이미 있는 그룹 이름입니다.');
    return this.prisma.group.create({ data: { name: trimmed } });
  }

  async remove(id: string) {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('그룹을 찾을 수 없습니다.');
    await this.prisma.group.delete({ where: { id } });
    return { success: true };
  }

  async listMembers(id: string) {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('그룹을 찾을 수 없습니다.');
    return this.prisma.user.findMany({
      where: { groupId: id },
      select: { id: true, username: true, email: true, rating: true },
      orderBy: { username: 'asc' },
    });
  }

  async addMember(id: string, userId: string) {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('그룹을 찾을 수 없습니다.');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    await this.prisma.user.update({ where: { id: userId }, data: { groupId: id } });
    return { success: true };
  }

  async removeMember(id: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.groupId !== id) throw new NotFoundException('이 그룹의 멤버가 아닙니다.');
    await this.prisma.user.update({ where: { id: userId }, data: { groupId: null } });
    return { success: true };
  }
}
