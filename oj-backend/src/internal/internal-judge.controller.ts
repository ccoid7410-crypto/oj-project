import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InternalTokenGuard } from './internal-token.guard';
import { JudgePayloadService } from './judge-payload.service';
import { JudgeIngestService } from './judge-ingest.service';
import { JUDGE_VERDICTS } from '../judge/judge-protocol';
import type { JudgeVerdict } from '../judge/judge-protocol';

const VERDICTS = JUDGE_VERDICTS as readonly string[];

class TestResultDto {
  @IsString() @MaxLength(64) testCaseId: string;
  @IsIn(VERDICTS) status: JudgeVerdict;
  @IsInt() @Min(0) runtimeMs: number;
  @IsOptional() @IsNumber() @Min(0) score?: number;
  @IsString() @MaxLength(4000) output: string;
}

class IngestDto {
  @IsString() @MaxLength(64) submissionId: string;
  @IsIn(VERDICTS) status: JudgeVerdict;
  @IsOptional() @IsInt() @Min(0) runtimeMs?: number;
  @IsOptional() @IsInt() @Min(0) memoryKb?: number;
  @IsOptional() @IsNumber() @Min(0) score?: number;
  @IsOptional() @IsString() @MaxLength(8000) errorMessage?: string;

  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => TestResultDto)
  testResults: TestResultDto[];
}

class MarkJudgingDto {
  @IsString() @MaxLength(64) submissionId: string;
}

/**
 * 인터체인저 전용 내부 API. 별도 리스너(INTERNAL_PORT)에만 마운트되며 nginx는 프록시하지 않는다.
 * 채점 VM은 여기에 직접 오지 않는다 - 항상 인터체인저를 거친다.
 */
@UseGuards(InternalTokenGuard)
@Controller('internal/judge')
export class InternalJudgeController {
  constructor(
    private readonly payload: JudgePayloadService,
    private readonly ingest: JudgeIngestService,
  ) {}

  /** 채점에 필요한 재료 일체(소스/제한/러너설정/테스트케이스)를 조립해서 준다. */
  @Get('payload/:submissionId')
  getPayload(@Param('submissionId') submissionId: string) {
    return this.payload.build(submissionId);
  }

  @Post('status')
  async markJudging(@Body() dto: MarkJudgingDto) {
    await this.ingest.markJudging(dto.submissionId);
    return { ok: true };
  }

  @Post('ingest')
  ingestResult(@Body() dto: IngestDto) {
    return this.ingest.ingest({
      // leaseId는 인터체인저가 검증하고 소비하는 값이라 API까지 넘어오지 않는다.
      leaseId: '',
      submissionId: dto.submissionId,
      status: dto.status,
      runtimeMs: dto.runtimeMs,
      memoryKb: dto.memoryKb,
      errorMessage: dto.errorMessage,
      testResults: dto.testResults,
    });
  }
}
