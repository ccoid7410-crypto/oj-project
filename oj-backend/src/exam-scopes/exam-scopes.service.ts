import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateExamScopeDto,
  EditExamScopeDto,
  ExamScopeQueryDto,
} from './dto/exam-scope.dto';

@Injectable()
export class ExamScopesService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ExamScopeQueryDto) {
    return this.prisma.examScope.findMany({
      where: {
        academicYear: query.academicYear,
        semester: query.semester,
        examType: query.examType,
      },
      orderBy: [{ displayOrder: 'asc' }, { subject: 'asc' }],
    });
  }

  async update(id: string, userId: string, scope: string) {
    await this.assertHiftEditor(userId);
    const existing = await this.prisma.examScope.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('시험범위를 찾을 수 없습니다.');

    return this.prisma.examScope.update({
      where: { id },
      data: { scope: scope.trim(), updatedById: userId },
    });
  }

  /** 과목 추가. 표시 순서는 같은 학기·시험 구분의 맨 뒤로 붙인다. */
  async create(userId: string, dto: CreateExamScopeDto) {
    await this.assertHiftEditor(userId);
    const subject = dto.subject.trim();
    const duplicate = await this.prisma.examScope.findUnique({
      where: {
        academicYear_semester_examType_subject: {
          academicYear: dto.academicYear,
          semester: dto.semester,
          examType: dto.examType,
          subject,
        },
      },
    });
    if (duplicate) throw new BadRequestException('이미 있는 과목입니다.');

    const last = await this.prisma.examScope.findFirst({
      where: {
        academicYear: dto.academicYear,
        semester: dto.semester,
        examType: dto.examType,
      },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });

    return this.prisma.examScope.create({
      data: {
        academicYear: dto.academicYear,
        semester: dto.semester,
        examType: dto.examType,
        subject,
        scope: dto.scope?.trim() ?? '',
        displayOrder: (last?.displayOrder ?? 0) + 1,
        updatedById: userId,
      },
    });
  }

  /** 과목 이름·범위·표시 순서 편집. 넘어온 항목만 반영한다. */
  async edit(id: string, userId: string, dto: EditExamScopeDto) {
    await this.assertHiftEditor(userId);
    const existing = await this.prisma.examScope.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('시험범위를 찾을 수 없습니다.');

    const subject = dto.subject?.trim();
    if (subject && subject !== existing.subject) {
      const duplicate = await this.prisma.examScope.findUnique({
        where: {
          academicYear_semester_examType_subject: {
            academicYear: existing.academicYear,
            semester: existing.semester,
            examType: existing.examType,
            subject,
          },
        },
      });
      if (duplicate) throw new BadRequestException('이미 있는 과목입니다.');
    }

    return this.prisma.examScope.update({
      where: { id },
      data: {
        ...(subject ? { subject } : {}),
        ...(dto.scope !== undefined ? { scope: dto.scope.trim() } : {}),
        ...(dto.displayOrder !== undefined
          ? { displayOrder: dto.displayOrder }
          : {}),
        updatedById: userId,
      },
    });
  }

  private async assertHiftEditor(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    if (user?.username !== 'hift') {
      throw new ForbiddenException(
        '시험범위는 지정 관리자만 수정할 수 있습니다.',
      );
    }
  }
}
