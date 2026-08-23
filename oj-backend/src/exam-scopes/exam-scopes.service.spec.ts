import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ExamScopesService } from './exam-scopes.service';

describe('ExamScopesService', () => {
  const findUser = jest.fn();
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const findFirst = jest.fn();
  const update = jest.fn();
  const create = jest.fn();
  const prisma = {
    user: { findUnique: findUser },
    examScope: { findMany, findUnique, findFirst, update, create },
  };
  const service = new ExamScopesService(prisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('lists one exam period in display order', async () => {
    findMany.mockResolvedValue([]);
    await service.list({
      academicYear: 2026,
      semester: 2,
      examType: 'MIDTERM',
    });

    expect(findMany).toHaveBeenCalledWith({
      where: { academicYear: 2026, semester: 2, examType: 'MIDTERM' },
      orderBy: [{ displayOrder: 'asc' }, { subject: 'asc' }],
    });
  });

  it('only lets hift edit exam scopes', async () => {
    findUser.mockResolvedValue({ username: 'someone-else' });
    await expect(
      service.update('scope-1', 'user-1', '1단원'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('trims the scope when hift updates it', async () => {
    findUser.mockResolvedValue({ username: 'hift' });
    findUnique.mockResolvedValue({ id: 'scope-1' });
    update.mockResolvedValue({ id: 'scope-1', scope: '1단원' });

    await service.update('scope-1', 'hift-id', '  1단원  ');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'scope-1' },
      data: { scope: '1단원', updatedById: 'hift-id' },
    });
  });

  it('reports a missing scope', async () => {
    findUser.mockResolvedValue({ username: 'hift' });
    findUnique.mockResolvedValue(null);
    await expect(
      service.update('missing', 'hift-id', ''),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adds a subject at the end of the display order', async () => {
    findUser.mockResolvedValue({ username: 'hift' });
    findUnique.mockResolvedValue(null); // 중복 없음
    findFirst.mockResolvedValue({ displayOrder: 3 });
    create.mockResolvedValue({ id: 'new' });

    await service.create('hift-id', {
      academicYear: 2026,
      semester: 2,
      examType: 'MIDTERM',
      subject: '  물리  ',
      scope: '  1단원  ',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        academicYear: 2026,
        semester: 2,
        examType: 'MIDTERM',
        subject: '물리',
        scope: '1단원',
        displayOrder: 4,
        updatedById: 'hift-id',
      },
    });
  });

  it('rejects a duplicate subject', async () => {
    findUser.mockResolvedValue({ username: 'hift' });
    findUnique.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create('hift-id', {
        academicYear: 2026,
        semester: 2,
        examType: 'MIDTERM',
        subject: '수학',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('edits only the fields that were sent', async () => {
    findUser.mockResolvedValue({ username: 'hift' });
    findUnique.mockResolvedValue({
      id: 'scope-1',
      subject: '수학',
      academicYear: 2026,
      semester: 2,
      examType: 'MIDTERM',
    });
    update.mockResolvedValue({ id: 'scope-1' });

    await service.edit('scope-1', 'hift-id', { displayOrder: 2 });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'scope-1' },
      data: { displayOrder: 2, updatedById: 'hift-id' },
    });
  });
});
