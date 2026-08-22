import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_ONLY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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
  @IsIn(['ASSESSMENT', 'EXAM', 'EVENT', 'OTHER', 'VACATION', 'CUSTOM'])
  type: 'ASSESSMENT' | 'EXAM' | 'EVENT' | 'OTHER' | 'VACATION' | 'CUSTOM';

  /** type=CUSTOM일 때 쓸 종류 이름(부원이 직접 입력). 그 외 종류에서는 무시된다. */
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: '종류 이름은 20자 이하여야 합니다.' })
  customType?: string;

  @IsString()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  subject?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsIn(['1반', '2반', '3반'], { each: true })
  classTags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  examScope?: string;

  @IsOptional()
  @Matches(TIME_ONLY_PATTERN, {
    message: 'deadlineTime은 HH:mm 형식이어야 합니다.',
  })
  deadlineTime?: string;

  @Matches(DATE_ONLY_PATTERN, {
    message: 'startsOn은 YYYY-MM-DD 형식이어야 합니다.',
  })
  startsOn: string;

  @Matches(DATE_ONLY_PATTERN, {
    message: 'endsOn은 YYYY-MM-DD 형식이어야 합니다.',
  })
  endsOn: string;
}

export class RejectClubScheduleDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
