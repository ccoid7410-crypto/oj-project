import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudentIdService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- 동아리 학번 명단(화이트리스트) ----

  async listRoster() {
    return this.prisma.clubRosterEntry.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /** 여러 줄(또는 콤마)로 붙여넣은 학번을 한 번에 등록. 이미 있는 학번은 건너뛴다. */
  async bulkAddRoster(entries: Array<{ studentId: string; name?: string }>) {
    if (!entries.length) throw new BadRequestException('추가할 학번이 없습니다.');
    const added: string[] = [];
    const skipped: string[] = [];
    for (const e of entries) {
      const studentId = e.studentId.trim();
      if (!studentId) continue;
      const exists = await this.prisma.clubRosterEntry.findUnique({ where: { studentId } });
      if (exists) {
        skipped.push(studentId);
        continue;
      }
      await this.prisma.clubRosterEntry.create({ data: { studentId, name: e.name?.trim() || null } });
      added.push(studentId);
    }
    return { addedCount: added.length, skippedCount: skipped.length, added, skipped };
  }

  async removeRoster(id: string) {
    const entry = await this.prisma.clubRosterEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('명단에 없는 항목입니다.');
    await this.prisma.clubRosterEntry.delete({ where: { id } });
    return { success: true };
  }

  async isInRoster(studentId: string): Promise<boolean> {
    return !!(await this.prisma.clubRosterEntry.findUnique({ where: { studentId } }));
  }

  async rosterSize(): Promise<number> {
    return this.prisma.clubRosterEntry.count();
  }

  /**
   * 명단이 하나라도 등록돼 있으면, 그 학번은 반드시 명단에 있어야 유효하다.
   * 명단이 비어 있으면(아직 관리자가 아무것도 안 넣었으면) 검증하지 않는다.
   */
  async assertValidForSignup(studentId: string | undefined) {
    if (!studentId) return;
    const size = await this.rosterSize();
    if (size === 0) return;
    const ok = await this.isInRoster(studentId);
    if (!ok) throw new ConflictException('동아리 학번 명단에 없는 학번입니다.');
  }

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

    await this.assertValidForSignup(studentId);

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
