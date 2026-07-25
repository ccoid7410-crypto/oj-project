import { JudgePayloadService } from './judge-payload.service';

describe('JudgePayloadService', () => {
  it('inserts problem compile options before the source file', async () => {
    const prisma = {
      submission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'submission-1',
          language: 'CPP',
          sourceCode: 'int main() {}',
          problemId: 'problem-1',
          problem: {
            timeLimitMs: 2000,
            memoryLimitMb: 256,
            problemType: 'STANDARD',
            scoringMode: 'TARGET',
            maxScore: 100,
            compileOptions: { CPP: ['-O0', '-std=c++20'] },
          },
        }),
      },
      testCase: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const judgeConfig = {
      getRunnerConfig: jest.fn().mockResolvedValue({
        fileName: 'main.cpp',
        compileImage: 'gcc:13-bookworm',
        compileCmd: ['g++', '-O2', '-o', '/box/a.out', '/box/main.cpp'],
        runImage: 'gcc:13-bookworm',
        runCmd: ['/box/a.out'],
      }),
    };
    const service = new JudgePayloadService(prisma as any, judgeConfig as any);

    const payload = await service.build('submission-1');

    expect(payload.runnerConfig.compileCmd).toEqual([
      'g++',
      '-O2',
      '-o',
      '/box/a.out',
      '-O0',
      '-std=c++20',
      '/box/main.cpp',
    ]);
  });
});
