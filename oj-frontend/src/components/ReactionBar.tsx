import { useState } from 'react';
import { REACTION_EMOJIS, type ReactionState } from '../api/types';

/**
 * 카톡 공감처럼 이모지로 반응을 남기는 바. 유저당 이모지 1개(다시 누르면 취소, 다른 걸 누르면 교체).
 * 버튼 모양/크기는 VoteButtons(좋아요/싫어요)와 동일하게 맞춘다.
 */
export function ReactionBar({
  state,
  onReact,
  disabled,
  size = 'sm',
}: {
  state: ReactionState;
  onReact: (emoji: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const pad = size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  const base = `flex items-center gap-1 rounded border ${pad} disabled:opacity-50`;

  function pick(emoji: string) {
    setOpen(false);
    onReact(emoji);
  }

  return (
    <div className="flex items-center gap-1.5">
      {state.reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          disabled={disabled}
          onClick={() => onReact(r.emoji)}
          className={`${base} ${
            state.myReaction === r.emoji
              ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
              : 'border-ink-500 text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]'
          }`}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}
      {!disabled && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            title="공감 남기기"
            className={`${base} border-ink-500 text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]`}
          >
            😊+
          </button>
          {open && (
            <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-1 rounded-lg border border-ink-500 bg-white p-1.5 shadow-lg">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => pick(emoji)}
                  className={`rounded px-1 text-lg hover:bg-ink-600 ${
                    state.myReaction === emoji ? 'bg-[var(--color-brand)]/15' : ''
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
