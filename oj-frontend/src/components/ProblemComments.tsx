import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { ProblemComment } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';

export function ProblemComments({ problemId }: { problemId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<ProblemComment[]>([]);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<ProblemComment[]>(`/problems/${problemId}/comments`).then(setComments);
  }

  useEffect(load, [problemId]);

  async function onSubmit() {
    if (!content.trim()) return;
    setError(null);
    try {
      await api.post(`/problems/${problemId}/comments`, { content, parentId: replyTo ?? undefined });
      setContent('');
      setReplyTo(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '등록에 실패했습니다.');
    }
  }

  async function onDelete(commentId: string) {
    if (!confirm('이 댓글을 삭제할까요?')) return;
    await api.delete(`/problems/${problemId}/comments/${commentId}`);
    load();
  }

  const topLevel = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  return (
    <div className="mt-4 border-t border-ink-500 pt-6">
      <h2 className="text-lg font-bold">질문 & 답변</h2>

      <ul className="mt-4 flex flex-col gap-3">
        {topLevel.map((c) => (
          <li key={c.id} className="rounded border border-ink-500 p-3 text-sm">
            <CommentRow comment={c} onDelete={onDelete} onReply={() => setReplyTo(c.id)} canManage={canManage(c)} />
            {repliesOf(c.id).length > 0 && (
              <ul className="mt-2 flex flex-col gap-2 border-l-2 border-ink-500 pl-3">
                {repliesOf(c.id).map((r) => (
                  <li key={r.id}>
                    <CommentRow comment={r} onDelete={onDelete} canManage={canManage(r)} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {topLevel.length === 0 && <p className="text-sm text-fg-muted">아직 등록된 질문이 없습니다.</p>}
      </ul>

      {user ? (
        <div className="mt-4">
          {replyTo && (
            <p className="mb-1 text-xs text-fg-muted">
              답글 작성 중{' '}
              <button type="button" onClick={() => setReplyTo(null)} className="underline">
                취소
              </button>
            </p>
          )}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder={replyTo ? '답글 내용' : '질문을 남겨보세요'}
            className="w-full resize-y rounded border border-ink-500 bg-white p-2 text-sm outline-none focus:border-[var(--color-brand)]"
          />
          {error && <p className="mt-1 text-xs text-[var(--color-wa)]">{error}</p>}
          <button
            type="button"
            onClick={onSubmit}
            className="mt-2 rounded bg-[var(--color-brand)] px-4 py-1.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)]"
          >
            등록
          </button>
        </div>
      ) : (
        <p className="mt-4 text-xs text-fg-muted">로그인하면 질문을 남길 수 있어요.</p>
      )}
    </div>
  );

  function canManage(c: ProblemComment): boolean {
    return !!user && (user.username === c.user.username || user.role === 'ADMIN');
  }
}

function CommentRow({
  comment,
  onDelete,
  onReply,
  canManage,
}: {
  comment: ProblemComment;
  onDelete: (id: string) => void;
  onReply?: () => void;
  canManage: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold">
          <Avatar username={comment.user.username} avatarVersion={comment.user.avatarVersion} size={18} />
          {comment.user.username}
        </span>
        <span className="text-xs text-fg-muted">{new Date(comment.createdAt).toLocaleString('ko-KR')}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
      <div className="mt-1 flex gap-3 text-xs text-fg-muted">
        {onReply && (
          <button type="button" onClick={onReply} className="hover:text-[var(--color-brand)]">
            답글
          </button>
        )}
        {canManage && (
          <button type="button" onClick={() => onDelete(comment.id)} className="hover:text-[var(--color-wa)]">
            삭제
          </button>
        )}
      </div>
    </div>
  );
}
