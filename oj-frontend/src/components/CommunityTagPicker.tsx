import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';

/**
 * 커뮤니티 게시글 태그 선택기. 문제 태그(TagPicker)와 같은 방식이되, 보드(OJ/HOME)별로
 * 태그 풀이 분리된다. 원하는 태그가 없으면 이 자리에서 바로 만들 수 있고(로그인 사용자),
 * 만든 태그는 목록에 남아 다른 사람도 재사용할 수 있다.
 */
export function CommunityTagPicker({
  board,
  value,
  onChange,
}: {
  board: string;
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ id: string; name: string }[]>(`/community/tags?board=${board}`)
      .then((tags) => setOptions(tags.map((t) => t.name)))
      .catch(() => setOptions([]));
  }, [board]);

  function toggle(tag: string) {
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  }

  async function addTag() {
    const name = newTag.trim();
    if (!name || adding) return;
    setAdding(true);
    setError(null);
    try {
      const created = await api.post<{ id: string; name: string }>('/community/tags', { board, name });
      setOptions((prev) => (prev.includes(created.name) ? prev : [...prev, created.name].sort()));
      if (!value.includes(created.name)) onChange([...value, created.name]);
      setNewTag('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '태그 추가에 실패했습니다.');
    } finally {
      setAdding(false);
    }
  }

  const customTags = value.filter((t) => !options.includes(t));

  return (
    <div className="flex flex-col gap-1 text-sm">
      태그 (복수 선택 가능)
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((tag) => {
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
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          maxLength={20}
          placeholder="새 태그"
          className="w-24 rounded-full border border-dashed border-ink-500 px-2.5 py-1 text-xs outline-none focus:border-[var(--color-brand)]"
        />
        <button
          type="button"
          onClick={addTag}
          disabled={adding || !newTag.trim()}
          className="rounded-full border border-ink-500 px-2.5 py-1 text-xs text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] disabled:opacity-50"
        >
          {adding ? '추가 중...' : '+ 추가'}
        </button>
      </div>
      {error && <p className="text-xs text-[var(--color-wa)]">{error}</p>}
      {customTags.length > 0 && (
        <p className="text-xs text-fg-muted">목록 외 기존 태그 (자동 유지): {customTags.join(', ')}</p>
      )}
    </div>
  );
}
