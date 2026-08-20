import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

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
