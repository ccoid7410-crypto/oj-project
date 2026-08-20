import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExamScopesService } from './exam-scopes.service';

describe('ExamScopesService', () => {
  const findUser = jest.fn();
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const update = jest.fn();
  const prisma = {
    user: { findUnique: findUser },
    examScope: { findMany, findUnique, update },
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

  it('only lets hift update a scope', async () => {
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
});
