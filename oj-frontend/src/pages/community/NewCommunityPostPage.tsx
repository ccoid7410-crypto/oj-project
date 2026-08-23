import { lazy, Suspense, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { CommunityPostType, MentionUser } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { CommunityTagPicker } from '../../components/CommunityTagPicker';
import { applyMentionChips } from '../../components/MentionText';

// 편집기(마크다운 렌더러 포함)가 무거워서 이 화면에 들어올 때 불러온다.
const MarkdownEditor = lazy(() =>
  import('../../components/MarkdownEditor').then((m) => ({ default: m.MarkdownEditor })),
);

/** 미리보기: 마크다운으로 그린 뒤, 실제로 존재하는 계정만 멘션 칩으로 바꾼다. */
function renderPreviewWithMentions(content: string, container: HTMLElement) {
  const body = document.createElement('div');
  body.className = 'markdown-body';
  container.appendChild(body);

  void import('../../lib/markdown').then(({ renderMarkdownToHtml }) => {
    body.innerHTML = content.trim()
      ? renderMarkdownToHtml(content)
      : '<p class="text-fg-muted">내용이 없습니다.</p>';
    if (!content.trim()) return;
    api
      .post<MentionUser[]>('/community/mentions/resolve', { content })
      .then((found) => applyMentionChips(body, found))
      .catch(() => {
        /* 확인에 실패하면 멘션 없이 원문 그대로 둔다 */
      });
  });
}

export function NewCommunityPostPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<CommunityPostType>('NORMAL');
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <span>내용</span>
          {/* 문제 설명과 같은 공용 편집기(원문 편집 + 미리보기)를 쓴다.
              제목은 이 페이지가 따로 받으므로 편집기에는 본문만 맡긴다. */}
          <Suspense fallback={<p className="p-3 text-sm text-fg-muted">편집기 불러오는 중...</p>}>
            <MarkdownEditor
              content={content}
              onContentChange={setContent}
              placeholder="내용을 입력하세요"
              renderPreview={renderPreviewWithMentions}
            />
          </Suspense>
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
