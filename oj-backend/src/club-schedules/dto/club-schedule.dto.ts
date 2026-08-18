import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ScheduleRangeDto {
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'from은 YYYY-MM-DD 형식이어야 합니다.',
  })
  from?: string;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'to는 YYYY-MM-DD 형식이어야 합니다.' })
  to?: string;
}

export class SaveClubScheduleDto {
  @IsIn(['ASSESSMENT', 'EXAM'])
  type: 'ASSESSMENT' | 'EXAM';

  @IsString()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  examScope?: string;

  @Matches(DATE_ONLY_PATTERN, {
    message: 'startsOn은 YYYY-MM-DD 형식이어야 합니다.',
  })
  startsOn: string;

  @Matches(DATE_ONLY_PATTERN, {
    message: 'endsOn은 YYYY-MM-DD 형식이어야 합니다.',
  })
  endsOn: string;
}
