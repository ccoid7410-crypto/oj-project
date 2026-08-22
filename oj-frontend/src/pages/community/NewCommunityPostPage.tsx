import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { CommunityPostType, MentionUser } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { CommunityTagPicker } from '../../components/CommunityTagPicker';
import { MentionScope } from '../../components/MentionText';

// KaTeX(수식) 번들이 커서 미리보기를 켤 때만 lazy load 한다.
const MarkdownView = lazy(() =>
  import('../../components/MarkdownView').then((m) => ({ default: m.MarkdownView })),
);

// 마크다운 툴바 에디터도 무거워서(tiptap + 이미지 편집기) 필요할 때 불러온다.
const MarkdownEditor = lazy(() =>
  import('../../components/MarkdownEditor').then((m) => ({ default: m.MarkdownEditor })),
);

export function NewCommunityPostPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<CommunityPostType>('NORMAL');
  const [tags, setTags] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 미리보기에서도 @사용자명을 칩으로 보여주려면 초안에 실제 계정이 있는지 물어봐야 한다.
  const [mentions, setMentions] = useState<MentionUser[]>([]);

  useEffect(() => {
    if (!preview || !content.trim()) return;
    let alive = true;
    api
      .post<MentionUser[]>('/community/mentions/resolve', { content })
      .then((found) => {
        if (alive) setMentions(found);
      })
      .catch(() => {
        /* 확인에 실패하면 멘션 없이 원문 그대로 보여준다 */
      });
    return () => {
      alive = false;
    };
  }, [preview, content]);

  // 유형은 하나만 고를 수 있다. 체크를 풀면 일반(NORMAL)로 돌아간다.
  function toggleType(t: Exclude<CommunityPostType, 'NORMAL'>) {
    setType((cur) => (cur === t ? 'NORMAL' : t));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<{ id: string }>('/community/posts', {
        board: 'OJ',
        title,
        content,
        type,
        tags,
      });
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

        {/* 게시글 유형: 업데이트 로그는 누구나, 공지는 어드민만 보이고 고를 수 있다. */}
        <div className="flex flex-col gap-1.5 text-sm">
          게시글 유형
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={type === 'UPDATE_LOG'}
                onChange={() => toggleType('UPDATE_LOG')}
              />
              <span className="text-[var(--color-brand)]">업데이트 로그</span>
            </label>
            {isAdmin && (
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={type === 'NOTICE'} onChange={() => toggleType('NOTICE')} />
                <span className="text-[var(--color-wa)]">공지</span>
              </label>
            )}
          </div>
        </div>

        <CommunityTagPicker board="OJ" value={tags} onChange={setTags} />

        <div className="flex flex-col gap-1 text-sm">
          <div className="flex items-center justify-between">
            <span>내용</span>
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
              <MentionScope mentions={mentions} deps={[content]}>
                <Suspense fallback={<p className="text-sm text-fg-muted">미리보기 불러오는 중...</p>}>
                  {content.trim() ? (
                    <MarkdownView content={content} />
                  ) : (
                    <p className="text-sm text-fg-muted">내용이 없습니다.</p>
                  )}
                </Suspense>
              </MentionScope>
            </div>
          ) : (
            /* 문제 설명과 같은 마크다운 툴바(글자 서식·이미지 첨부 등)를 그대로 쓴다.
               제목은 이 페이지가 따로 받으므로 에디터에는 본문만 맡긴다. */
            <div className="rounded border border-ink-500">
              <Suspense fallback={<p className="p-3 text-sm text-fg-muted">편집기 불러오는 중...</p>}>
                <MarkdownEditor
                  content={content}
                  onContentChange={setContent}
                  placeholder="내용을 입력하세요. 마크다운과 이미지 첨부를 쓸 수 있습니다."
                />
              </Suspense>
            </div>
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
