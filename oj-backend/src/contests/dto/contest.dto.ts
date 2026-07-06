import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ContestProblemDto {
  @IsString()
  problemId: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  points?: number;
}

export class CreateContestDto {
  @IsString()
  title: string;

  @Matches(/^[a-z0-9-]+$/, { message: 'slug은 영문 소문자/숫자/하이픈만 가능합니다.' })
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsArray()
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
  @ValidateNested({ each: true })
  @Type(() => ContestProblemDto)
  problems: ContestProblemDto[];
}
