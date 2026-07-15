import type { VoteSummary } from '../api/types';

/**
 * 좋아요/싫어요 버튼 한 쌍. 게시글·댓글 어디서든 재사용한다.
 * onVote(1|-1)을 호출하면 부모가 API를 쳐서 최신 집계로 상태를 갱신한다.
 * (같은 값을 다시 누르면 서버가 토글로 취소한다.)
 */
export function VoteButtons({
  summary,
  onVote,
  disabled,
  size = 'sm',
}: {
  summary: VoteSummary;
  onVote: (value: 1 | -1) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const pad = size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onVote(1)}
        aria-pressed={summary.myVote === 1}
        title="좋아요"
        className={`flex items-center gap-1 rounded border ${pad} disabled:opacity-50 ${
          summary.myVote === 1
            ? 'border-[var(--color-ac)] bg-[var(--color-ac)]/10 text-[var(--color-ac)]'
            : 'border-ink-500 text-fg-muted hover:border-[var(--color-ac)] hover:text-[var(--color-ac)]'
        }`}
      >
        <span aria-hidden>▲</span>
        {summary.likeCount}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onVote(-1)}
        aria-pressed={summary.myVote === -1}
        title="싫어요"
        className={`flex items-center gap-1 rounded border ${pad} disabled:opacity-50 ${
          summary.myVote === -1
            ? 'border-[var(--color-wa)] bg-[var(--color-wa)]/10 text-[var(--color-wa)]'
            : 'border-ink-500 text-fg-muted hover:border-[var(--color-wa)] hover:text-[var(--color-wa)]'
        }`}
      >
        <span aria-hidden>▼</span>
        {summary.dislikeCount}
      </button>
    </div>
  );
}
