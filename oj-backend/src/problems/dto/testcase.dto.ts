import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateTestCaseDto {
  @IsString()
  input: string;

  @IsString()
  output: string;

  @IsOptional()
  @IsBoolean()
  isSample?: boolean;
}

export class UpdateTestCaseDto {
  @IsOptional()
  @IsString()
  input?: string;

  @IsOptional()
  @IsString()
  output?: string;

  @IsOptional()
  @IsBoolean()
  isSample?: boolean;
}
