import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ClubSchedulesService } from './club-schedules.service';

describe('ClubSchedulesService', () => {
  const findMany = jest.fn();
  const create = jest.fn();
  const updateMany = jest.fn();
  const findUser = jest.fn();
  const prisma = {
    user: { findUnique: findUser },
    clubSchedule: {
      findMany,
      findUnique: jest.fn(),
      create,
      update: jest.fn(),
      updateMany,
      delete: jest.fn(),
    },
  };
  const service = new ClubSchedulesService(prisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('queries schedules that overlap the requested date range', async () => {
    findMany.mockResolvedValue([]);
    await service.list({ from: '2026-08-01', to: '2026-08-31' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'APPROVED',
          startsOn: { lte: new Date('2026-08-31T00:00:00.000Z') },
          endsOn: { gte: new Date('2026-08-01T00:00:00.000Z') },
        },
      }),
    );
  });

  it('rejects impossible dates and reversed ranges', async () => {
    await expect(service.list({ from: '2026-02-30' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.list({ from: '2026-09-01', to: '2026-08-31' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('trims schedule text and stores date-only values', async () => {
    const now = new Date('2026-08-18T00:00:00.000Z');
    create.mockResolvedValue({
      id: 'schedule-1',
      type: 'EXAM',
      status: 'PENDING',
      title: '중간고사',
      subject: '정보',
      classTags: ['1반', '3반'],
      description: '안내',
      examScope: '1~3단원',
      deadlineTime: '',
      startsOn: new Date('2026-08-20T00:00:00.000Z'),
      endsOn: new Date('2026-08-21T00:00:00.000Z'),
      createdById: 'admin-1',
      updatedById: 'admin-1',
      reviewedById: null,
      reviewedAt: null,
      rejectionReason: '',
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.propose('admin-1', {
      type: 'EXAM',
      title: '  중간고사  ',
      subject: ' 정보 ',
      classTags: ['1반', '3반'],
      description: ' 안내 ',
      examScope: ' 1~3단원 ',
      deadlineTime: undefined,
      startsOn: '2026-08-20',
      endsOn: '2026-08-21',
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: '중간고사',
        status: 'PENDING',
        subject: '정보',
        classTags: ['1반', '3반'],
        examScope: '1~3단원',
        startsOn: new Date('2026-08-20T00:00:00.000Z'),
        endsOn: new Date('2026-08-21T00:00:00.000Z'),
      }),
    });
    expect(result.startsOn).toBe('2026-08-20');
    expect(result.endsOn).toBe('2026-08-21');
  });

  it('only lets the hift username review pending schedules', async () => {
    findUser.mockResolvedValue({ username: 'someone-else' });

    await expect(
      service.approve('schedule-1', 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('requires a deadline time for assessments', async () => {
    await expect(
      service.propose('member-1', {
        type: 'ASSESSMENT',
        title: '수행평가',
        startsOn: '2026-08-25',
        endsOn: '2026-08-20',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('does not let a regular member delete schedules', async () => {
    findUser.mockResolvedValue({ username: 'someone-else' });

    await expect(
      service.remove('schedule-1', 'member-1', 'MEMBER'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.clubSchedule.delete).not.toHaveBeenCalled();
  });

  it('lets the hift member delete schedules', async () => {
    findUser.mockResolvedValue({ username: 'hift' });
    prisma.clubSchedule.findUnique.mockResolvedValue({ id: 'schedule-1' });

    await expect(
      service.remove('schedule-1', 'hift-user', 'MEMBER'),
    ).resolves.toEqual({ deleted: true });
    expect(prisma.clubSchedule.delete).toHaveBeenCalledWith({
      where: { id: 'schedule-1' },
    });
  });
});
