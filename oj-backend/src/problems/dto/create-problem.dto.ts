import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DifficultyDto {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  DIAMOND = 'DIAMOND',
  RUBY = 'RUBY',
}

export enum LanguageDto {
  C = 'C',
  CPP = 'CPP',
  JAVA = 'JAVA',
  PYTHON3 = 'PYTHON3',
  JAVASCRIPT = 'JAVASCRIPT',
  GO = 'GO',
}

export enum ProblemTypeDto {
  STANDARD = 'STANDARD',
  SCORING = 'SCORING',
  INTERACTIVE = 'INTERACTIVE',
}

export enum ScoringModeDto {
  TARGET = 'TARGET',
  MAXIMIZE = 'MAXIMIZE',
  MINIMIZE = 'MINIMIZE',
}

export class TestCaseInputDto {
  @IsString()
  @MaxLength(1_000_000)
  input: string;

  @IsString()
  @MaxLength(1_000_000)
  output: string;

  @IsOptional()
  @IsBoolean()
  isSample?: boolean;
}

export class CreateProblemDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug은 영문 소문자/숫자/하이픈만 가능합니다.',
  })
  slug: string;

  @IsString()
  @MaxLength(200_000)
  description: string;

  @IsOptional()
  @IsEnum(DifficultyDto)
  difficulty?: DifficultyDto;

  /** 세분화된 난이도(1=브론즈V ~ 30=루비I). 주어지면 difficulty는 이 값에서 자동 파생된다. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  level?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(10_000)
  timeLimitMs?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(16)
  @Max(1024)
  memoryLimitMb?: number;

  @IsOptional()
  @IsEnum(ProblemTypeDto)
  problemType?: ProblemTypeDto;

  @IsOptional()
  @IsEnum(ScoringModeDto)
  scoringMode?: ScoringModeDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Max(1_000_000)
  maxScore?: number;

  /** 공개되지만 사용자 레이팅에는 반영하지 않는 연습 문제. */
  @IsOptional()
  @IsBoolean()
  isPractice?: boolean;

  /** 언어별 추가 컴파일 인자. 예: { "CPP": ["-O0", "-std=c++20"] } */
  @IsOptional()
  @IsObject()
  compileOptions?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsEnum(LanguageDto, { each: true })
  allowedLanguages?: LanguageDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => TestCaseInputDto)
  testCases?: TestCaseInputDto[];

  /** 대회 전용 문제로 만들지 여부. 어드민만 지정 가능(그 외는 무시됨). */
  @IsOptional()
  @IsBoolean()
  contestOnly?: boolean;

  /** 일반 사용자는 필수: 이 코드가 모든 테스트케이스를 통과해야 문제 제안이 등록된다. */
  @IsOptional()
  @IsEnum(LanguageDto)
  verificationLanguage?: LanguageDto;

  @IsOptional()
  @IsString()
  @MaxLength(65_536)
  verificationCode?: string;
}
