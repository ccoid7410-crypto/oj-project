import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';

describe('SubmissionsService authorization', () => {
  const problem = {
    id: 'problem-1',
    status: 'PUBLISHED',
    authorId: 'author',
    allowedLanguages: [],
    tags: [],
    contestOnly: true,
  };
  const prisma = {
    problem: { findUnique: jest.fn(), count: jest.fn() },
    contestProblem: { findUnique: jest.fn() },
    contestParticipant: { findUnique: jest.fn() },
    submission: { create: jest.fn(), findMany: jest.fn() },
  };
  const queue = { add: jest.fn() };
  const priority = { nextPriority: jest.fn() };
  const service = new SubmissionsService(prisma as any, queue as any, priority as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.problem.findUnique.mockResolvedValue(problem);
    prisma.problem.count.mockResolvedValue(0);
  });

  it('blocks submission to a hidden contest-only problem without contest context', async () => {
    await expect(
      service.create('attacker', 'USER', {
        problemId: problem.id,
        language: 'CPP' as any,
        sourceCode: 'int main() {}',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.submission.create).not.toHaveBeenCalled();
  });

  it('blocks non-admin submission to an internal test problem', async () => {
    prisma.problem.findUnique.mockResolvedValue({ ...problem, contestOnly: false, tags: ['test'] });
    await expect(
      service.create('attacker', 'USER', {
        problemId: problem.id,
        language: 'CPP' as any,
        sourceCode: 'int main() {}',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
