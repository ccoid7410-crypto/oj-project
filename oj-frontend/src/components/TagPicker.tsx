import { TAG_OPTIONS } from '../lib/tags';

/** 정해진 목록에서 태그를 골라 복수 선택하는 입력. 목록에 없는 기존 태그는 지우지 않고 유지한다. */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  function toggle(tag: string) {
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  }

  const customTags = value.filter((t) => !TAG_OPTIONS.includes(t));

  return (
    <div className="flex flex-col gap-1 text-sm">
      태그 (복수 선택 가능)
      <div className="flex flex-wrap gap-1.5">
        {TAG_OPTIONS.map((tag) => {
          const selected = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={
                selected
                  ? 'rounded-full bg-[var(--color-brand)] px-2.5 py-1 text-xs font-bold text-white'
                  : 'rounded-full border border-ink-500 px-2.5 py-1 text-xs text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]'
              }
            >
              {tag}
            </button>
          );
        })}
      </div>
      {customTags.length > 0 && (
        <p className="text-xs text-fg-muted">목록 외 기존 태그 (자동 유지): {customTags.join(', ')}</p>
      )}
    </div>
  );
}
