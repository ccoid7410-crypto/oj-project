import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ClubSchedule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  SaveClubScheduleDto,
  ScheduleRangeDto,
} from './dto/club-schedule.dto';

function parseDateOnly(value: string, fieldName: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException(`${fieldName}이 올바른 날짜가 아닙니다.`);
  }
  return date;
}

function serializeSchedule(schedule: ClubSchedule) {
  return {
    id: schedule.id,
    type: schedule.type,
    customType: schedule.customType,
    status: schedule.status,
    title: schedule.title,
    subject: schedule.subject,
    classTags: schedule.classTags,
    description: schedule.description,
    examScope: schedule.examScope,
    deadlineTime: schedule.deadlineTime,
    startsOn: schedule.startsOn.toISOString().slice(0, 10),
    endsOn: schedule.endsOn.toISOString().slice(0, 10),
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
    rejectionReason: schedule.rejectionReason,
  };
}

@Injectable()
export class ClubSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(range: ScheduleRangeDto) {
    const from = range.from ? parseDateOnly(range.from, 'from') : undefined;
    const to = range.to ? parseDateOnly(range.to, 'to') : undefined;
    if (from && to && to < from) {
      throw new BadRequestException('to는 from과 같거나 뒤여야 합니다.');
    }

    const schedules = await this.prisma.clubSchedule.findMany({
      where: {
        status: 'APPROVED',
        ...(to ? { startsOn: { lte: to } } : {}),
        ...(from ? { endsOn: { gte: from } } : {}),
      },
      orderBy: [{ startsOn: 'asc' }, { type: 'asc' }, { title: 'asc' }],
    });
    return schedules.map(serializeSchedule);
  }

  async listForManage() {
    const schedules = await this.prisma.clubSchedule.findMany({
      include: { createdBy: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return schedules.map((schedule) => ({
      ...serializeSchedule(schedule),
      proposedBy: schedule.createdBy?.username ?? null,
    }));
  }

  async listPending(approverId: string) {
    await this.assertHiftApprover(approverId);
    const schedules = await this.prisma.clubSchedule.findMany({
      where: { status: 'PENDING' },
      include: { createdBy: { select: { username: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return schedules.map((schedule) => ({
      ...serializeSchedule(schedule),
      proposedBy: schedule.createdBy?.username ?? null,
    }));
  }

  async propose(userId: string, dto: SaveClubScheduleDto) {
    const dates = this.validateDates(dto);
    const schedule = await this.prisma.clubSchedule.create({
      data: {
        type: dto.type,
        customType: dto.type === 'CUSTOM' ? (dto.customType?.trim() ?? '') : '',
        status: 'PENDING',
        title: dto.title.trim(),
        subject:
          dto.type === 'ASSESSMENT' || dto.type === 'EXAM'
            ? (dto.subject?.trim() ?? '')
            : '',
        classTags: dto.classTags ?? [],
        description: dto.description?.trim() ?? '',
        examScope: dto.examScope?.trim() ?? '',
        deadlineTime:
          dto.type === 'ASSESSMENT' ||
          dto.type === 'EVENT' ||
          dto.type === 'OTHER'
            ? (dto.deadlineTime ?? '')
            : '',
        ...dates,
        createdById: userId,
        updatedById: userId,
      },
    });
    return serializeSchedule(schedule);
  }

  async update(
    id: string,
    userId: string,
    role: string,
    dto: SaveClubScheduleDto,
  ) {
    await this.assertScheduleManager(userId, role);
    await this.ensureExists(id);
    const dates = this.validateDates(dto);
    const schedule = await this.prisma.clubSchedule.update({
      where: { id },
      data: {
        type: dto.type,
        customType: dto.type === 'CUSTOM' ? (dto.customType?.trim() ?? '') : '',
        title: dto.title.trim(),
        subject:
          dto.type === 'ASSESSMENT' || dto.type === 'EXAM'
            ? (dto.subject?.trim() ?? '')
            : '',
        classTags: dto.classTags ?? [],
        description: dto.description?.trim() ?? '',
        examScope: dto.examScope?.trim() ?? '',
        deadlineTime:
          dto.type === 'ASSESSMENT' ||
          dto.type === 'EVENT' ||
          dto.type === 'OTHER'
            ? (dto.deadlineTime ?? '')
            : '',
        ...dates,
        updatedById: userId,
      },
    });
    return serializeSchedule(schedule);
  }

  async approve(id: string, approverId: string) {
    await this.assertHiftApprover(approverId);
    const result = await this.prisma.clubSchedule.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        reviewedById: approverId,
        reviewedAt: new Date(),
        rejectionReason: '',
      },
    });
    if (result.count === 0) {
      throw new BadRequestException('승인 대기 중인 일정을 찾을 수 없습니다.');
    }
    const schedule = await this.prisma.clubSchedule.findUnique({
      where: { id },
    });
    if (!schedule) throw new NotFoundException('일정을 찾을 수 없습니다.');
    return serializeSchedule(schedule);
  }

  async reject(id: string, approverId: string, reason?: string) {
    await this.assertHiftApprover(approverId);
    const result = await this.prisma.clubSchedule.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        reviewedById: approverId,
        reviewedAt: new Date(),
        rejectionReason: reason?.trim() ?? '',
      },
    });
    if (result.count === 0) {
      throw new BadRequestException('승인 대기 중인 일정을 찾을 수 없습니다.');
    }
    return { rejected: true };
  }

  async remove(id: string, userId: string, role: string) {
    await this.assertScheduleManager(userId, role);
    await this.ensureExists(id);
    await this.prisma.clubSchedule.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * 종류 목록에 노출할 사용자 정의 종류. 승인된 일정에 쓰인 이름만 모아서 돌려주므로,
   * 제안만 하고 승인되지 않은 종류는 목록/범례에 나타나지 않는다.
   */
  async listCustomTypes() {
    const rows = await this.prisma.clubSchedule.findMany({
      where: { status: 'APPROVED', type: 'CUSTOM', customType: { not: '' } },
      select: { customType: true },
      distinct: ['customType'],
      orderBy: { customType: 'asc' },
    });
    return rows.map((r) => r.customType);
  }

  private validateDates(dto: SaveClubScheduleDto) {
    const startsOn = parseDateOnly(dto.startsOn, '시작일');
    if (!dto.title.trim()) {
      throw new BadRequestException('일정 제목을 입력해주세요.');
    }
    if (dto.type === 'CUSTOM' && !dto.customType?.trim()) {
      throw new BadRequestException('새 종류의 이름을 입력해주세요.');
    }
    if (dto.type === 'ASSESSMENT') {
      if (!dto.deadlineTime) {
        throw new BadRequestException('수행평가 마감 시간을 입력해주세요.');
      }
      return { startsOn, endsOn: startsOn };
    }
    const endsOn = parseDateOnly(dto.endsOn, '종료일');
    if (endsOn < startsOn) {
      throw new BadRequestException('종료일은 시작일과 같거나 뒤여야 합니다.');
    }
    return { startsOn, endsOn };
  }

  private async ensureExists(id: string) {
    const schedule = await this.prisma.clubSchedule.findUnique({
      where: { id },
    });
    if (!schedule) throw new NotFoundException('일정을 찾을 수 없습니다.');
  }

  private async assertHiftApprover(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    if (user?.username !== 'hift') {
      throw new ForbiddenException('일정 승인은 지정 관리자만 할 수 있습니다.');
    }
  }

  private async assertScheduleManager(userId: string, role: string) {
    if (role === 'ADMIN') return;
    await this.assertHiftApprover(userId);
  }
}
