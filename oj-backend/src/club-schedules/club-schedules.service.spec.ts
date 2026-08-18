import { BadRequestException } from '@nestjs/common';
import { ClubSchedulesService } from './club-schedules.service';

describe('ClubSchedulesService', () => {
  const findMany = jest.fn();
  const create = jest.fn();
  const prisma = {
    clubSchedule: {
      findMany,
      findUnique: jest.fn(),
      create,
      update: jest.fn(),
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
      title: '중간고사',
      subject: '정보',
      description: '안내',
      examScope: '1~3단원',
      startsOn: new Date('2026-08-20T00:00:00.000Z'),
      endsOn: new Date('2026-08-21T00:00:00.000Z'),
      createdById: 'admin-1',
      updatedById: 'admin-1',
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.create('admin-1', {
      type: 'EXAM',
      title: '  중간고사  ',
      subject: ' 정보 ',
      description: ' 안내 ',
      examScope: ' 1~3단원 ',
      startsOn: '2026-08-20',
      endsOn: '2026-08-21',
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: '중간고사',
        subject: '정보',
        examScope: '1~3단원',
        startsOn: new Date('2026-08-20T00:00:00.000Z'),
        endsOn: new Date('2026-08-21T00:00:00.000Z'),
      }),
    });
    expect(result.startsOn).toBe('2026-08-20');
    expect(result.endsOn).toBe('2026-08-21');
  });
});
