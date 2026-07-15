import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { api } from '../api/client';
import type { RankingRow } from '../api/types';
import { UserTitleBadge } from '../components/UserTitleBadge';

export function RankingPage() {
  const [rows, setRows] = useState<RankingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<RankingRow[]>('/users/ranking')
      .then(setRows)
      .catch(() => setError('랭킹을 불러오지 못했습니다.'));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">랭킹</h1>
      <p className="mt-1 text-xs text-fg-muted">
        레이팅 = 정답 처리된 문제 중 배점이 높은 상위 100개의 배점 합
      </p>

      {error && <p className="mt-6 text-sm text-[var(--color-wa)]">{error}</p>}

      {rows && rows.length === 0 && (
        <p className="mt-10 text-sm text-fg-muted">아직 레이팅이 있는 유저가 없습니다.</p>
      )}

      {rows && rows.length > 0 && (
        <table className="mt-4 w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-ink-700 text-fg-muted">
              <th className="w-14 border border-ink-600 px-2 py-1.5 text-center font-medium">#</th>
              <th className="border border-ink-600 px-3 py-1.5 font-medium">사용자</th>
              <th className="w-24 border border-ink-600 px-2 py-1.5 text-center font-medium">레이팅</th>
              <th className="w-24 border border-ink-600 px-2 py-1.5 text-center font-medium">해결한 문제</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.username} className="hover:bg-ink-700/60">
                <td className="border border-ink-600 px-2 py-1.5 text-center font-bold">{r.rank}</td>
                <td className="border border-ink-600 px-3 py-1.5">
                  <Link to={`/users/${r.username}`} className="inline-flex items-center gap-1.5 text-[var(--color-brand)] hover:underline">
                    <Avatar username={r.username} avatarVersion={r.avatarVersion} size={20} />
                    <UserTitleBadge title={r.customTitle} />
                    {r.username}
                  </Link>
                </td>
                <td className="border border-ink-600 px-2 py-1.5 text-center font-bold text-[var(--color-brand)]">
                  {r.rating}
                </td>
                <td className="border border-ink-600 px-2 py-1.5 text-center text-fg-muted">{r.solvedCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
