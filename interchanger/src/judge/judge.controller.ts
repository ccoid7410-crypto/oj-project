import {
  BadRequestException,
  Body,
  Controller,
  GoneException,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JudgeTokenGuard } from './judge-token.guard';
import { LeaseService } from './lease.service';
import { JUDGE_VERDICTS } from './judge-protocol';
import type { JudgeVerdict } from './judge-protocol';

const VERDICTS = JUDGE_VERDICTS as readonly string[];

/** 큐가 비었을 때 이 시간까지 요청을 붙잡고 기다린다(롱폴링). */
const LONG_POLL_MS = 20_000;
const LONG_POLL_TICK_MS = 1_000;

class LeaseDto {
  @IsString() @MaxLength(128) workerId: string;
  @IsInt() @Min(0) @Max(16) capacity: number;
}

class HeartbeatDto {
  @IsString() @MaxLength(64) leaseId: string;
}

class TestResultDto {
  @IsString() @MaxLength(64) testCaseId: string;
  @IsIn(VERDICTS) status: JudgeVerdict;
  @IsInt() @Min(0) runtimeMs: number;
  @IsOptional() @IsNumber() @Min(0) score?: number;
  @IsString() @MaxLength(4000) output: string;
}

class ResultDto {
  @IsString() @MaxLength(64) leaseId: string;
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

/**
 * 채점 VM 전용 API. 내부 리스너(:4001)에만 마운트되며 공개 리스너에는 존재하지 않는다.
 */
@UseGuards(JudgeTokenGuard)
@Controller('internal/judge')
export class JudgeController {
  constructor(private readonly leases: LeaseService) {}

  /**
   * 채점할 일감을 당겨간다. capacity는 채점기가 지금 더 받을 수 있는 개수라서,
   * 이 값 자체가 백프레셔 역할을 한다(별도 rate limit이 필요 없다).
   */
  @Post('lease')
  @HttpCode(200)
  async lease(@Body() dto: LeaseDto) {
    if (dto.capacity === 0) return { leases: [] };

    const deadline = Date.now() + LONG_POLL_MS;
    for (;;) {
      const leases = await this.leases.lease(dto.workerId, dto.capacity);
      if (leases.length > 0) return { leases };
      if (Date.now() >= deadline) return { leases: [] };
      await new Promise((resolve) => setTimeout(resolve, LONG_POLL_TICK_MS));
    }
  }

  /**
   * 아직 채점 중임을 알려 리스를 연장한다.
   * 410이 오면 이미 회수된 리스이므로 채점기는 샌드박스를 죽이고 결과를 버려야 한다.
   */
  @Post('heartbeat')
  @HttpCode(200)
  async heartbeat(@Body() dto: HeartbeatDto) {
    const record = await this.leases.heartbeat(dto.leaseId);
    if (!record) {
      throw new GoneException('리스가 만료되어 회수되었습니다. 이 채점은 중단하세요.');
    }
    return { expiresAt: record.expiresAt };
  }

  @Post('result')
  @HttpCode(200)
  async result(@Body() dto: ResultDto) {
    const outcome = await this.leases.submitResult(dto);
    if (!outcome.accepted && outcome.reason) {
      throw new BadRequestException(outcome.reason);
    }
    return { duplicate: outcome.duplicate };
  }
}
