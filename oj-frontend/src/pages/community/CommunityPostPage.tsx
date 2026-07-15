import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { CommunityPostDetail, VoteSummary } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../../components/Avatar';
import { UserTitleBadge } from '../../components/UserTitleBadge';
import { VoteButtons } from '../../components/VoteButtons';
import { CommunityComments } from '../../components/CommunityComments';

// KaTeX(수식) 번들이 커서 이 페이지에서만 lazy load 한다.
const MarkdownView = lazy(() =>
  import('../../components/MarkdownView').then((m) => ({ default: m.MarkdownView })),
);

export function CommunityPostPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState<CommunityPostDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    api
      .get<CommunityPostDetail>(`/community/posts/${id}`)
      .then(setPost)
      .catch(() => setError('게시글을 찾을 수 없습니다.'));
  }, [id]);

  useEffect(load, [load]);

  async function onVote(value: 1 | -1) {
    if (!user || !post) return;
    try {
      const summary = await api.post<VoteSummary>(`/community/posts/${post.id}/vote`, { value });
      setPost((prev) => (prev ? { ...prev, ...summary } : prev));
    } catch {
      /* 무시: 다음 로드에서 정정됨 */
    }
  }

  async function onDelete() {
    if (!post) return;
    if (!confirm('이 게시글을 삭제할까요? 되돌릴 수 없습니다.')) return;
    try {
      await api.delete(`/community/posts/${post.id}`);
      navigate('/community');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '삭제에 실패했습니다.');
    }
  }

  if (error) return <p className="text-sm text-[var(--color-wa)]">{error}</p>;
  if (!post) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  const canManage = !!user && (user.username === post.author.username || user.role === 'ADMIN');

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/community" className="text-xs text-fg-muted hover:text-[var(--color-brand)]">
        ← 커뮤니티
      </Link>

      <h1 className="mt-2 text-2xl font-bold">{post.title}</h1>
      <div className="mt-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-fg-muted">
          <Avatar username={post.author.username} avatarVersion={post.author.avatarVersion} size={20} />
          <UserTitleBadge title={post.author.customTitle} />
          <span className="font-medium text-fg">{post.author.username}</span>
          <span>·</span>
          <span>{new Date(post.createdAt).toLocaleString('ko-KR')}</span>
        </span>
        {canManage && (
          <button type="button" onClick={onDelete} className="text-xs text-fg-muted hover:text-[var(--color-wa)]">
            삭제
          </button>
        )}
      </div>

      <div className="mt-4 border-t border-ink-500 pt-4">
        <Suspense fallback={<p className="whitespace-pre-wrap text-sm text-fg">{post.content}</p>}>
          <MarkdownView content={post.content} className="text-fg" />
        </Suspense>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <VoteButtons summary={post} onVote={onVote} disabled={!user} size="md" />
        {!user && <span className="text-xs text-fg-muted">로그인하면 좋아요를 누를 수 있어요.</span>}
      </div>

      <CommunityComments postId={post.id} comments={post.comments} onReload={load} />
    </div>
  );
}
