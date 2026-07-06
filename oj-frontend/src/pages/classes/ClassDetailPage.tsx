import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { ClassDetail } from '../../api/types';
import { DifficultyBadge } from '../../components/DifficultyBadge';

export function ClassDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    api
      .get<ClassDetail>(`/classes/${slug}`)
      .then(setCls)
      .catch((err) => setError(err instanceof ApiError ? err.message : '수업을 불러오지 못했습니다.'));
  }, [slug]);

  if (error) return <p className="text-sm text-[var(--color-wa)]">{error}</p>;
  if (!cls) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">{cls.name}</h1>
      {cls.description && <p className="mt-1 text-sm text-fg-muted">{cls.description}</p>}

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-bold text-fg-muted">문제집</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {cls.problems.map((p) => (
              <li key={p.id} className="rounded border border-ink-500 p-2 text-sm">
                <Link to={`/problems/${p.slug}`} className="flex items-center gap-2 hover:text-[var(--color-brand)]">
                  <DifficultyBadge level={p.level} /> {p.title}
                </Link>
              </li>
            ))}
            {cls.problems.length === 0 && <p className="text-sm text-fg-muted">아직 등록된 문제가 없습니다.</p>}
          </ul>

          <h2 className="mt-6 text-sm font-bold text-fg-muted">공지</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {cls.notices.map((n) => (
              <li key={n.id} className="rounded border border-ink-500 p-2 text-sm">
                <p className="font-bold">{n.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-fg-muted">{n.content}</p>
                <p className="mt-1 text-xs text-fg-muted">{new Date(n.createdAt).toLocaleString('ko-KR')}</p>
              </li>
            ))}
            {cls.notices.length === 0 && <p className="text-sm text-fg-muted">아직 공지가 없습니다.</p>}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold text-fg-muted">순위 (문제집 기준 해결 수)</h2>
          <table className="mt-2 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-ink-500 text-xs text-fg-muted">
                <th className="py-2 font-medium">#</th>
                <th className="py-2 font-medium">이름</th>
                <th className="py-2 font-medium">해결</th>
              </tr>
            </thead>
            <tbody>
              {cls.ranking.map((r, i) => (
                <tr key={r.userId} className="border-b border-ink-600">
                  <td className="py-2 text-fg-muted">{i + 1}</td>
                  <td className="py-2">
                    <Link to={`/users/${r.username}`} className="hover:text-[var(--color-brand)]">
                      {r.username}
                    </Link>
                  </td>
                  <td className="py-2 text-fg-muted">{r.solvedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
