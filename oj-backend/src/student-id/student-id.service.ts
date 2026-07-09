import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudentIdService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- 학번 "수정" 허용 기간 ----

  async getWindow() {
    const row = await this.prisma.studentIdEditWindow.findUnique({ where: { id: 1 } });
    return { startsAt: row?.startsAt ?? null, endsAt: row?.endsAt ?? null };
  }

  async setWindow(startsAt: Date | null, endsAt: Date | null, updatedById?: string) {
    if (startsAt && endsAt && endsAt <= startsAt) {
      throw new BadRequestException('종료 시각은 시작 시각보다 뒤여야 합니다.');
    }
    await this.prisma.studentIdEditWindow.upsert({
      where: { id: 1 },
      create: { id: 1, startsAt, endsAt, updatedById },
      update: { startsAt, endsAt, updatedById },
    });
    return this.getWindow();
  }

  async isWindowOpen(now = new Date()): Promise<boolean> {
    const { startsAt, endsAt } = await this.getWindow();
    if (!startsAt || !endsAt) return false;
    return now >= startsAt && now <= endsAt;
  }

  /** 유저 본인의 학번 수정. 최초 등록(null → 값)은 기간과 무관하게 허용, 이미 값이 있으면 기간 내에만 허용. */
  async updateOwnStudentId(userId: string, studentId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

    if (user.studentId) {
      const open = await this.isWindowOpen();
      if (!open) {
        throw new BadRequestException('지금은 학번 수정 기간이 아닙니다. 관리자가 연 기간에만 수정할 수 있습니다.');
      }
    }

    const taken = await this.prisma.user.findUnique({ where: { studentId } });
    if (taken && taken.id !== userId) {
      throw new ConflictException('이미 다른 계정에 등록된 학번입니다.');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { studentId },
      select: { id: true, studentId: true },
    });
  }
}
