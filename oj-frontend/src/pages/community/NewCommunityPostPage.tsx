import { lazy, Suspense, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';

// KaTeX(수식) 번들이 커서 미리보기를 켤 때만 lazy load 한다.
const MarkdownView = lazy(() =>
  import('../../components/MarkdownView').then((m) => ({ default: m.MarkdownView })),
);

export function NewCommunityPostPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<{ id: string }>('/community/posts', { title, content });
      navigate(`/community/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '게시글 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]';

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">글쓰기</h1>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          제목
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className={inputClass}
          />
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center justify-between">
            <span>내용 (마크다운 · TeX 지원)</span>
            <button
              type="button"
              onClick={() => setPreview((v) => !v)}
              className="text-xs text-fg-muted underline hover:text-[var(--color-brand)]"
            >
              {preview ? '편집' : '미리보기'}
            </button>
          </div>
          {preview ? (
            <div className="min-h-[240px] rounded border border-ink-500 bg-white p-3">
              <Suspense fallback={<p className="text-sm text-fg-muted">미리보기 불러오는 중...</p>}>
                {content.trim() ? (
                  <MarkdownView content={content} />
                ) : (
                  <p className="text-sm text-fg-muted">내용이 없습니다.</p>
                )}
              </Suspense>
            </div>
          ) : (
            <textarea
              required
              rows={14}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={'마크다운을 쓸 수 있어요.\n수식은 $a+b$ (인라인), $$\\int x\\,dx$$ (블록)'}
              className={`${inputClass} resize-y font-mono leading-relaxed`}
            />
          )}
        </div>

        {error && <p className="text-xs text-[var(--color-wa)]">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
          >
            {submitting ? '등록 중...' : '등록'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/community')}
            className="rounded border border-ink-500 px-4 py-2 text-sm text-fg hover:border-[var(--color-brand)]"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
