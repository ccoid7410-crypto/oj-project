import { BadRequestException } from '@nestjs/common';
import { JudgeConfigService } from './judge-config.service';
import { RunnerFactory } from '../judge/runners/runner.factory';

describe('JudgeConfigService security', () => {
  const upsert = jest.fn();
  const prisma = {
    judgeConfig: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert,
    },
  };
  const service = new JudgeConfigService(prisma as any, new RunnerFactory());

  beforeEach(() => jest.clearAllMocks());

  it('rejects path-affecting and unknown override keys', async () => {
    await expect(
      service.update({ CPP: { fileName: '../../host-file' } } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejects malformed commands and image names', async () => {
    await expect(service.update({ CPP: { runCmd: [] } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update({ CPP: { runImage: 'image name with spaces' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores a validated allowlisted override', async () => {
    upsert.mockResolvedValue({});
    await service.update({ CPP: { runCmd: ['/box/a.out'], runImage: 'gcc:13-bookworm' } });
    expect(upsert).toHaveBeenCalledTimes(1);
    const saved = upsert.mock.calls[0][0].create.config;
    expect(saved.CPP).toEqual({ runCmd: ['/box/a.out'], runImage: 'gcc:13-bookworm' });
  });
});
