import type { SubmissionStatus } from '../api/types';

const LABEL: Record<SubmissionStatus, string> = {
  PENDING: '채점 대기 중',
  JUDGING: '채점 중',
  ACCEPTED: '맞았습니다!!',
  WRONG_ANSWER: '틀렸습니다',
  TIME_LIMIT_EXCEEDED: '시간 초과',
  MEMORY_LIMIT_EXCEEDED: '메모리 초과',
  RUNTIME_ERROR: '런타임 에러',
  COMPILE_ERROR: '컴파일 에러',
  INTERNAL_ERROR: '채점 오류',
};

const COLOR: Record<SubmissionStatus, string> = {
  PENDING: 'text-[var(--color-pending)]',
  JUDGING: 'text-[var(--color-pending)]',
  ACCEPTED: 'text-[var(--color-ac)]',
  WRONG_ANSWER: 'text-[var(--color-wa)]',
  TIME_LIMIT_EXCEEDED: 'text-[var(--color-tle)]',
  MEMORY_LIMIT_EXCEEDED: 'text-[var(--color-tle)]',
  RUNTIME_ERROR: 'text-[var(--color-wa)]',
  COMPILE_ERROR: 'text-[var(--color-ce)]',
  INTERNAL_ERROR: 'text-[var(--color-ce)]',
};

export function VerdictBadge({
  status,
  showPulse = true,
}: {
  status: SubmissionStatus;
  /** 목록 화면에서는 스펙상 진행 상태 pulse 애니메이션을 제외한다. 실시간 상세 화면(SubmissionPage)만 유지. */
  showPulse?: boolean;
}) {
  const isLive = showPulse && (status === 'PENDING' || status === 'JUDGING');
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${COLOR[status]}`}>
      {isLive && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-current" />}
      {LABEL[status]}
    </span>
  );
}
