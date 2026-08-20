import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ExamScopeQueryDto } from './dto/exam-scope.dto';

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
