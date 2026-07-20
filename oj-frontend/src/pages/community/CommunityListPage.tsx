import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { CommunityPostSummary } from '../../api/types';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../../components/Avatar';
import { UserTitleBadge } from '../../components/UserTitleBadge';
import { PostTypeBadge, postTitleColorClass } from '../../components/CommunityPostType';

export function CommunityListPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<CommunityPostSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<CommunityPostSummary[]>('/community/posts?board=OJ')
      .then(setPosts)
      .catch(() => setError('게시글을 불러오지 못했습니다.'));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">커뮤니티</h1>
        {user ? (
          <Link
            to="/community/new"
            className="rounded bg-[var(--color-brand)] px-3 py-1.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)]"
          >
            글쓰기
          </Link>
        ) : (
          <Link to="/login?redirect=/community" className="text-sm text-fg-muted hover:text-[var(--color-brand)]">
            로그인하고 글쓰기
          </Link>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-[var(--color-wa)]">{error}</p>}
      {posts && posts.length === 0 && (
        <p className="mt-10 text-sm text-fg-muted">아직 게시글이 없습니다. 첫 글을 남겨보세요!</p>
      )}

      {posts && posts.length > 0 && (
        <ul className="mt-4 divide-y divide-ink-500 border-y border-ink-500">
          {posts.map((p) => (
            <li key={p.id} className={p.type === 'NOTICE' ? 'bg-[var(--color-wa)]/5 py-3' : 'py-3'}>
              <Link to={`/community/${p.id}`} className="group flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center">
                    <PostTypeBadge type={p.type} />
                    <span className={`truncate text-sm font-bold group-hover:underline ${postTitleColorClass(p.type)}`}>
                      {p.title}
                    </span>
                    {p.commentCount > 0 && (
                      <span className="ml-1.5 shrink-0 text-xs font-normal text-[var(--color-brand)]">
                        [{p.commentCount}]
                      </span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
                    <Avatar username={p.author.username} avatarVersion={p.author.avatarVersion} size={16} />
                    <UserTitleBadge title={p.author.customTitle} />
                    <span>{p.author.username}</span>
                    <span>·</span>
                    <span>{new Date(p.createdAt).toLocaleDateString('ko-KR')}</span>
                    {p.tags.map((t) => (
                      <span key={t} className="rounded-full bg-ink-600 px-1.5 py-0.5 text-[10px] text-fg-muted">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-0.5 text-xs text-fg-muted">
                  <span className="text-[var(--color-ac)]">▲ {p.likeCount}</span>
                  <span className="text-[var(--color-wa)]">▼ {p.dislikeCount}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
