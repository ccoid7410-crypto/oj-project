import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum LanguageDto {
  C = 'C',
  CPP = 'CPP',
  JAVA = 'JAVA',
  PYTHON3 = 'PYTHON3',
  JAVASCRIPT = 'JAVASCRIPT',
  GO = 'GO',
}

export class CreateSubmissionDto {
  @IsString()
  problemId: string;

  @IsOptional()
  @IsString()
  contestId?: string;

  @IsEnum(LanguageDto)
  language: LanguageDto;

  @IsString()
  @MaxLength(65536, { message: '소스코드는 64KB를 넘을 수 없습니다.' })
  sourceCode: string;
}
