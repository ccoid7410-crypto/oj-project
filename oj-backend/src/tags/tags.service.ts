import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.tagOption.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async create(name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('태그 이름을 입력해주세요.');
    const exists = await this.prisma.tagOption.findUnique({ where: { name: trimmed } });
    if (exists) throw new ConflictException('이미 있는 태그입니다.');
    return this.prisma.tagOption.create({ data: { name: trimmed }, select: { id: true, name: true } });
  }

  /** 목록에서만 제거한다. 이미 문제에 붙어 있는 태그 문자열은 건드리지 않는다. */
  async remove(id: string) {
    const tag = await this.prisma.tagOption.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('태그를 찾을 수 없습니다.');
    await this.prisma.tagOption.delete({ where: { id } });
    return { success: true };
  }
}
