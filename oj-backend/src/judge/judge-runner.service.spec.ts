import { JudgeRunnerService } from './judge-runner.service';
import type { JudgeLease } from './judge-protocol';

function lease(overrides: Partial<JudgeLease> = {}): JudgeLease {
  return {
    leaseId: 'lease-1',
    submissionId: 'submission-1',
    attempt: 1,
    language: 'PYTHON3',
    sourceCode: 'print(9)',
    timeLimitMs: 1000,
    memoryLimitMb: 64,
    problemType: 'STANDARD',
    scoringMode: 'TARGET',
    maxScore: 100,
    runnerConfig: {
      fileName: 'main.py',
      compileCmd: null,
      runImage: 'python:3.12-slim',
      runCmd: ['python3', '/box/main.py'],
    },
    testCases: [{ id: 'tc-1', input: '', output: '10' }],
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

describe('JudgeRunnerService problem types', () => {
  const config = {
    get: jest.fn((_key: string, fallback: unknown) => fallback),
  };

  it('calculates a target-accuracy score', async () => {
    const sandbox = {
      run: jest.fn().mockResolvedValue({
        stdout: '9\n',
        stderr: '',
        exitCode: 0,
        timedOut: false,
        outputLimitExceeded: false,
        runtimeMs: 12,
      }),
    };
    const runner = new JudgeRunnerService(sandbox as any, config as any);

    const result = await runner.run(lease({ problemType: 'SCORING' }));

    expect(result.status).toBe('ACCEPTED');
    expect(result.score).toBe(90);
    expect(result.testResults[0].score).toBe(90);
  });

  it('maps an interactive transcript mismatch to WRONG_ANSWER', async () => {
    const sandbox = {
      run: jest.fn().mockResolvedValue({
        stdout: 'unexpected\n',
        stderr: '',
        exitCode: 42,
        timedOut: false,
        outputLimitExceeded: false,
        runtimeMs: 8,
      }),
    };
    const runner = new JudgeRunnerService(sandbox as any, config as any);

    const result = await runner.run(
      lease({
        problemType: 'INTERACTIVE',
        testCases: [{ id: 'tc-1', input: 'question', output: 'answer' }],
      }),
    );

    expect(result.status).toBe('WRONG_ANSWER');
    expect(result.testResults[0].status).toBe('WRONG_ANSWER');
  });
});
