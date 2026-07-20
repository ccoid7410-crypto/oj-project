import {
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ContestProblemDto {
  @IsString()
  @MaxLength(64)
  problemId: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  points?: number;
}

export class CreateContestDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug은 영문 소문자/숫자/하이픈만 가능합니다.' })
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ContestProblemDto)
  problems?: ContestProblemDto[];

  /** 대회 전용 문제가 대회 종료 후 일반 문제 목록에 공개될지. 기본값 true. */
  @IsOptional()
  @IsBoolean()
  problemsVisibleAfterEnd?: boolean;
}

export class SetContestProblemsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ContestProblemDto)
  problems: ContestProblemDto[];
}
