import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { CommunityComment, VoteSummary } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';
import { UserTitleBadge } from './UserTitleBadge';
import { VoteButtons } from './VoteButtons';

/**
 * 커뮤니티 게시글의 댓글/답글. 문제 Q&A 댓글(ProblemComments)과 같은 구조에
 * 좋아요/싫어요를 더한 버전. 추가/삭제는 상위(onReload)로 게시글 전체를 다시 불러오고,
 * 투표는 해당 댓글만 최신 집계로 부분 갱신한다.
 */
export function CommunityComments({
  postId,
  comments,
  onReload,
}: {
  postId: string;
  comments: CommunityComment[];
  onReload: () => void;
}) {
  const { user } = useAuth();
  const [list, setList] = useState<CommunityComment[]>(comments);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 댓글 정렬: 인기순(좋아요-싫어요, 기본) / 날짜순(오래된 순) / 최신순
  const [sort, setSort] = useState<'popular' | 'old' | 'new'>('popular');

  // 상위에서 새 목록이 내려오면 로컬 상태를 맞춘다.
  useEffect(() => setList(comments), [comments]);

  async function onSubmit() {
    if (!content.trim()) return;
    setError(null);
    try {
      await api.post(`/community/posts/${postId}/comments`, {
        content,
        parentId: replyTo ?? undefined,
      });
      setContent('');
      setReplyTo(null);
      onReload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '등록에 실패했습니다.');
    }
  }

  async function onDelete(commentId: string) {
    if (!confirm('이 댓글을 삭제할까요?')) return;
    await api.delete(`/community/comments/${commentId}`);
    onReload();
  }

  async function onVote(commentId: string, value: 1 | -1) {
    if (!user) return;
    try {
      const summary = await api.post<VoteSummary>(`/community/comments/${commentId}/vote`, { value });
      setList((prev) => prev.map((c) => (c.id === commentId ? { ...c, ...summary } : c)));
    } catch {
      /* 투표 실패는 조용히 무시(다음 로드에서 정정됨) */
    }
  }

  function score(c: CommunityComment) {
    return c.likeCount - c.dislikeCount;
  }
  const sorters: Record<typeof sort, (a: CommunityComment, b: CommunityComment) => number> = {
    // 인기순: 좋아요-싫어요 높은 순, 동점이면 오래된 순
    popular: (a, b) => score(b) - score(a) || +new Date(a.createdAt) - +new Date(b.createdAt),
    old: (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
    new: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  };
  const topLevel = list.filter((c) => !c.parentId).sort(sorters[sort]);
  // 답글은 항상 오래된 순으로 스레드처럼 보여준다.
  const repliesOf = (id: string) =>
    list.filter((c) => c.parentId === id).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

  function canManage(c: CommunityComment): boolean {
    return !!user && (user.username === c.user.username || user.role === 'ADMIN');
  }

  return (
    <div className="mt-6 border-t border-ink-500 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          댓글 {list.length > 0 && <span className="text-fg-muted">({list.length})</span>}
        </h2>
        {list.length > 0 && (
          <div className="flex gap-1 text-xs">
            {([
              ['popular', '인기순'],
              ['old', '날짜순'],
              ['new', '최신순'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className={
                  sort === key
                    ? 'rounded bg-[var(--color-brand)] px-2 py-1 font-bold text-white'
                    : 'rounded border border-ink-500 px-2 py-1 text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]'
                }
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {topLevel.map((c) => (
          <li key={c.id} className="rounded border border-ink-500 p-3 text-sm">
            <CommentRow
              comment={c}
              canVote={!!user}
              canManage={canManage(c)}
              onVote={(v) => onVote(c.id, v)}
              onDelete={() => onDelete(c.id)}
              onReply={() => setReplyTo(c.id)}
            />
            {repliesOf(c.id).length > 0 && (
              <ul className="mt-2 flex flex-col gap-2 border-l-2 border-ink-500 pl-3">
                {repliesOf(c.id).map((r) => (
                  <li key={r.id}>
                    <CommentRow
                      comment={r}
                      canVote={!!user}
                      canManage={canManage(r)}
                      onVote={(v) => onVote(r.id, v)}
                      onDelete={() => onDelete(r.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {topLevel.length === 0 && <p className="text-sm text-fg-muted">아직 댓글이 없습니다.</p>}
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
            placeholder={replyTo ? '답글 내용' : '댓글을 남겨보세요'}
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
        <p className="mt-4 text-xs text-fg-muted">로그인하면 댓글을 남길 수 있어요.</p>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  canVote,
  canManage,
  onVote,
  onDelete,
  onReply,
}: {
  comment: CommunityComment;
  canVote: boolean;
  canManage: boolean;
  onVote: (value: 1 | -1) => void;
  onDelete: () => void;
  onReply?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold">
          <Avatar username={comment.user.username} avatarVersion={comment.user.avatarVersion} size={18} />
          <UserTitleBadge title={comment.user.customTitle} />
          {comment.user.username}
        </span>
        <span className="text-xs text-fg-muted">{new Date(comment.createdAt).toLocaleString('ko-KR')}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-fg-muted">
        <VoteButtons summary={comment} onVote={onVote} disabled={!canVote} />
        {onReply && (
          <button type="button" onClick={onReply} className="hover:text-[var(--color-brand)]">
            답글
          </button>
        )}
        {canManage && (
          <button type="button" onClick={onDelete} className="hover:text-[var(--color-wa)]">
            삭제
          </button>
        )}
      </div>
    </div>
  );
}
