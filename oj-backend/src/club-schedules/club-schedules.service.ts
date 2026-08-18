import {
  BadRequestException,
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
    title: schedule.title,
    subject: schedule.subject,
    description: schedule.description,
    examScope: schedule.examScope,
    startsOn: schedule.startsOn.toISOString().slice(0, 10),
    endsOn: schedule.endsOn.toISOString().slice(0, 10),
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
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
      where:
        from || to
          ? {
              ...(to ? { startsOn: { lte: to } } : {}),
              ...(from ? { endsOn: { gte: from } } : {}),
            }
          : undefined,
      orderBy: [{ startsOn: 'asc' }, { type: 'asc' }, { title: 'asc' }],
    });
    return schedules.map(serializeSchedule);
  }

  async create(userId: string, dto: SaveClubScheduleDto) {
    const dates = this.validateDates(dto);
    const schedule = await this.prisma.clubSchedule.create({
      data: {
        type: dto.type,
        title: dto.title.trim(),
        subject: dto.subject?.trim() ?? '',
        description: dto.description?.trim() ?? '',
        examScope: dto.examScope?.trim() ?? '',
        ...dates,
        createdById: userId,
        updatedById: userId,
      },
    });
    return serializeSchedule(schedule);
  }

  async update(id: string, userId: string, dto: SaveClubScheduleDto) {
    await this.ensureExists(id);
    const dates = this.validateDates(dto);
    const schedule = await this.prisma.clubSchedule.update({
      where: { id },
      data: {
        type: dto.type,
        title: dto.title.trim(),
        subject: dto.subject?.trim() ?? '',
        description: dto.description?.trim() ?? '',
        examScope: dto.examScope?.trim() ?? '',
        ...dates,
        updatedById: userId,
      },
    });
    return serializeSchedule(schedule);
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.clubSchedule.delete({ where: { id } });
    return { deleted: true };
  }

  private validateDates(dto: SaveClubScheduleDto) {
    const startsOn = parseDateOnly(dto.startsOn, '시작일');
    const endsOn = parseDateOnly(dto.endsOn, '종료일');
    if (endsOn < startsOn) {
      throw new BadRequestException('종료일은 시작일과 같거나 뒤여야 합니다.');
    }
    if (!dto.title.trim()) {
      throw new BadRequestException('일정 제목을 입력해주세요.');
    }
    return { startsOn, endsOn };
  }

  private async ensureExists(id: string) {
    const schedule = await this.prisma.clubSchedule.findUnique({
      where: { id },
    });
    if (!schedule) throw new NotFoundException('일정을 찾을 수 없습니다.');
  }
}
