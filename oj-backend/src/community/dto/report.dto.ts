import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const REPORT_TARGET_TYPES = ['POST', 'COMMENT'] as const;
export type ReportTargetTypeValue = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  'SPAM',
  'ABUSE',
  'ADULT',
  'PRIVACY',
  'FALSE_INFO',
  'ETC',
] as const;
export type ReportReasonValue = (typeof REPORT_REASONS)[number];

export class CreateReportDto {
  @IsIn(REPORT_TARGET_TYPES, { message: '신고 대상이 올바르지 않습니다.' })
  targetType: ReportTargetTypeValue;

  @IsString()
  targetId: string;

  @IsIn(REPORT_REASONS, { message: '신고 종류를 선택해주세요.' })
  reason: ReportReasonValue;

  /** 신고자가 직접 적는 상세 내용. */
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: '신고 내용은 1000자 이하여야 합니다.' })
  detail?: string;
}

export const REPORT_ACTIONS = ['DELETE_TARGET', 'DISMISS'] as const;
export type ReportActionValue = (typeof REPORT_ACTIONS)[number];

export class ResolveReportDto {
  /** DELETE_TARGET=신고된 글/댓글 삭제 후 처리 완료, DISMISS=문제 없음으로 기각. */
  @IsIn(REPORT_ACTIONS, { message: '처리 방식이 올바르지 않습니다.' })
  action: ReportActionValue;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '처리 메모는 500자 이하여야 합니다.' })
  note?: string;
}
