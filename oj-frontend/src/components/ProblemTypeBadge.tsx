import type { ProblemType } from '../api/types';

const LABEL: Record<ProblemType, string> = {
  STANDARD: '일반',
  SCORING: '정확도',
  INTERACTIVE: '인터랙티브',
};

export function ProblemTypeBadge({
  type,
  isPractice = false,
}: {
  type: ProblemType;
  isPractice?: boolean;
}) {
  return (
    <>
      {type !== 'STANDARD' && (
        <span className="shrink-0 rounded border border-[var(--color-brand)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-brand)]">
          {LABEL[type]}
        </span>
      )}
      {isPractice && (
        <span className="shrink-0 rounded border border-ink-500 px-1.5 py-0.5 text-[10px] font-bold text-fg-muted">
          연습
        </span>
      )}
    </>
  );
}
