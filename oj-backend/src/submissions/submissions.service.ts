import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { JUDGE_QUEUE, JudgeJobData } from '../judge/judge.constants';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(JUDGE_QUEUE) private readonly judgeQueue: Queue<JudgeJobData>,
  ) {}

  async create(userId: string, userRole: string, dto: CreateSubmissionDto) {
    const problem = await this.prisma.problem.findUnique({ where: { id: dto.problemId } });
    if (!problem) throw new NotFoundException('문제를 찾을 수 없습니다.');

    // 공개되지 않은 문제는 작성자/어드민만 제출(테스트) 가능
    if (problem.status !== 'PUBLISHED' && problem.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('아직 공개되지 않은 문제입니다.');
    }

    // 문제별 허용 언어 제한 (비어 있으면 전체 허용)
    if (problem.allowedLanguages.length > 0 && !problem.allowedLanguages.includes(dto.language as any)) {
      throw new BadRequestException(
        `이 문제는 다음 언어로만 제출할 수 있습니다: ${problem.allowedLanguages.join(', ')}`,
      );
    }

    // 대회 문제 제출인 경우: 진행 중이고 참가자여야 함
    let contestId: string | null = null;
    if (dto.contestId) {
      const cp = await this.prisma.contestProblem.findUnique({
        where: { contestId_problemId: { contestId: dto.contestId, problemId: dto.problemId } },
        include: { contest: true },
      });
      if (!cp) throw new BadRequestException('해당 대회에 포함된 문제가 아닙니다.');
      const now = new Date();
      if (now < cp.contest.startsAt || now > cp.contest.endsAt) {
        throw new BadRequestException('대회 진행 시간이 아닙니다.');
      }
      const joined = await this.prisma.contestParticipant.findUnique({
        where: { contestId_userId: { contestId: dto.contestId, userId } },
      });
      if (!joined && userRole !== 'ADMIN') throw new ForbiddenException('대회에 참가하지 않았습니다.');
      contestId = dto.contestId;
    }

    const submission = await this.prisma.submission.create({
      data: {
        userId,
        problemId: dto.problemId,
        contestId,
        language: dto.language as any,
        sourceCode: dto.sourceCode,
        status: 'PENDING',
      },
    });

    await this.judgeQueue.add(
      'judge',
      { submissionId: submission.id },
      {
        attempts: 1, // 채점은 재시도하면 부작용(중복 실행)이 있어서 기본 1회. 실패 시 INTERNAL_ERROR로 마킹
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );

    return submission;
  }

  async findById(id: string, requesterId: string, requesterRole: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        testResults: { include: { testCase: { select: { isSample: true, order: true } } } },
      },
    });
    if (!submission) throw new NotFoundException('제출 내역을 찾을 수 없습니다.');
    // 본인 제출이 아니면(관리자 제외) 소스코드 등 상세 내용을 볼 수 없다.
    if (submission.userId !== requesterId && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('이 제출을 조회할 권한이 없습니다.');
    }
    return submission;
  }

  async findByUser(userId: string) {
    return this.prisma.submission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        problemId: true,
        language: true,
        status: true,
        runtimeMs: true,
        memoryKb: true,
        createdAt: true,
      },
    });
  }
}
