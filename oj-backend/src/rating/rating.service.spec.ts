import { RatingService } from './rating.service';

describe('RatingService', () => {
  it('excludes practice problems from rating', async () => {
    const prisma = {
      submission: { findMany: jest.fn().mockResolvedValue([]) },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    const service = new RatingService(prisma as any);

    await service.recomputeForUser('user-1');

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          problem: expect.objectContaining({ isPractice: false }),
        }),
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { rating: 0 },
    });
  });
});
