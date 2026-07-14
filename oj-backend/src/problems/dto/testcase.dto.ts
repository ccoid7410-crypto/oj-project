import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTestCaseDto {
  @IsString()
  input: string;

  @IsString()
  output: string;

  @IsOptional()
  @IsBoolean()
  isSample?: boolean;
}

export class BulkCreateTestCasesDto {
  // zip 하나에 케이스가 아주 많을 수 있지만, 한 요청에서 무한정 받으면 메모리/DB 부담이 커진다.
  // 그 이상은 zip을 나눠 올리도록 상한을 둔다.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => CreateTestCaseDto)
  testCases: CreateTestCaseDto[];
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
