import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JudgeConfigService } from '../judge-config/judge-config.service';
import type { JudgePayload } from '../judge/judge-protocol';

// 채점기가 보내온 값이 아니라 **여기서** 상한을 건다. 예전엔 이 clamp가 채점 프로세서 안에
// 있었는데, 채점기가 신뢰 경계 바깥(별도 VM)으로 나가면서 신뢰할 수 있는 쪽으로 옮겼다.
const MIN_TIME_LIMIT_MS = 100;
const MAX_TIME_LIMIT_MS = 10_000;
const MIN_MEMORY_LIMIT_MB = 16;
const MAX_MEMORY_LIMIT_MB = 1024;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function withProblemCompileOptions(
  command: string[] | null,
  fileName: string,
  rawOptions: unknown,
  language: string,
): string[] | null {
  if (!command) return null;
  const options =
    rawOptions && typeof rawOptions === 'object' && !Array.isArray(rawOptions)
      ? (rawOptions as Record<string, unknown>)[language]
      : undefined;
  if (!Array.isArray(options) || options.length === 0) return command;
  const safe = options.filter((arg): arg is string => typeof arg === 'string');
  const sourceIndex = command.indexOf(`/box/${fileName}`);
  const insertionIndex = sourceIndex >= 0 ? sourceIndex : command.length;
  return [
    ...command.slice(0, insertionIndex),
    ...safe,
    ...command.slice(insertionIndex),
  ];
}

/**
 * 제출 하나를 채점하는 데 필요한 모든 재료를 DB에서 모아 자족적인 페이로드로 만든다.
 * 채점 VM은 DB에 못 붙으므로, 여기서 빠뜨린 정보는 채점기가 알아낼 방법이 없다.
 */
@Injectable()
export class JudgePayloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly judgeConfig: JudgeConfigService,
  ) {}

  async build(submissionId: string): Promise<JudgePayload> {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { problem: true },
    });
    if (!submission) throw new NotFoundException('제출을 찾을 수 없습니다.');

    const [runnerConfig, testCases] = await Promise.all([
      this.judgeConfig.getRunnerConfig(submission.language),
      this.prisma.testCase.findMany({
        where: { problemId: submission.problemId },
        orderBy: { order: 'asc' },
        select: { id: true, input: true, output: true },
      }),
    ]);

    return {
      submissionId: submission.id,
      language: submission.language,
      sourceCode: submission.sourceCode,
      timeLimitMs: clamp(
        submission.problem.timeLimitMs,
        MIN_TIME_LIMIT_MS,
        MAX_TIME_LIMIT_MS,
      ),
      memoryLimitMb: clamp(
        submission.problem.memoryLimitMb,
        MIN_MEMORY_LIMIT_MB,
        MAX_MEMORY_LIMIT_MB,
      ),
      problemType: submission.problem.problemType,
      scoringMode: submission.problem.scoringMode,
      maxScore: submission.problem.maxScore,
      runnerConfig: {
        fileName: runnerConfig.fileName,
        compileImage: runnerConfig.compileImage,
        compileCmd: withProblemCompileOptions(
          runnerConfig.compileCmd,
          runnerConfig.fileName,
          submission.problem.compileOptions,
          submission.language,
        ),
        runImage: runnerConfig.runImage,
        runCmd: runnerConfig.runCmd,
      },
      testCases,
    };
  }
}
