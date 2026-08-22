import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ExamScopeQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  academicYear: number;

  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  semester: number;

  @IsIn(['MIDTERM', 'FINAL'])
  examType: 'MIDTERM' | 'FINAL';
}

export class UpdateExamScopeDto {
  @IsString()
  @MaxLength(5000)
  scope: string;
}

/** 과목 추가. 같은 학기·시험 구분 안에서 과목 이름은 중복될 수 없다. */
export class CreateExamScopeDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  academicYear: number;

  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2])
  semester: number;

  @IsIn(['MIDTERM', 'FINAL'])
  examType: 'MIDTERM' | 'FINAL';

  @IsString()
  @MinLength(1, { message: '과목 이름을 입력해주세요.' })
  @MaxLength(80, { message: '과목 이름은 80자 이하여야 합니다.' })
  subject: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  scope?: string;
}

/** 과목 이름·범위·표시 순서 편집. 넘긴 항목만 바뀐다. */
export class EditExamScopeDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '과목 이름을 입력해주세요.' })
  @MaxLength(80, { message: '과목 이름은 80자 이하여야 합니다.' })
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  scope?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  displayOrder?: number;
}
