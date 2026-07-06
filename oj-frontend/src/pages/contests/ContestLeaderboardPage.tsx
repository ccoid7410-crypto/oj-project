import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { LeaderboardRow } from '../../api/types';

export function ContestLeaderboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    api
      .get<LeaderboardRow[]>(`/contests/${slug}/leaderboard`)
      .then(setRows)
      .catch(() => setError('순위표를 불러오지 못했습니다.'));
  }, [slug]);

  if (error) return <p className="text-sm text-[var(--color-wa)]">{error}</p>;
  if (!rows) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  const labels = Array.from(new Set(rows.flatMap((r) => r.solved.map((s) => s.label)))).sort();

  return (
    <div>
      <h1 className="text-2xl font-bold">순위표</h1>

      {rows.length === 0 && <p className="mt-10 text-sm text-fg-muted">아직 참가자가 없습니다.</p>}

      {rows.length > 0 && (
        <table className="mt-4 w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-ink-700 text-fg-muted">
              <th className="w-12 border border-ink-600 px-2 py-1.5 text-center font-medium">#</th>
              <th className="border border-ink-600 px-3 py-1.5 font-medium">사용자</th>
              <th className="w-16 border border-ink-600 px-2 py-1.5 text-center font-medium">해결</th>
              <th className="w-16 border border-ink-600 px-2 py-1.5 text-center font-medium">점수</th>
              <th className="w-20 border border-ink-600 px-2 py-1.5 text-center font-medium">시간(분)</th>
              {labels.map((l) => (
                <th key={l} className="w-14 border border-ink-600 px-2 py-1.5 text-center font-medium">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const byLabel = new Map(r.solved.map((s) => [s.label, s.minutes]));
              return (
                <tr key={r.userId} className="hover:bg-ink-700/60">
                  <td className="border border-ink-600 px-2 py-1.5 text-center font-bold">{r.rank}</td>
                  <td className="border border-ink-600 px-3 py-1.5 font-medium">{r.username}</td>
                  <td className="border border-ink-600 px-2 py-1.5 text-center">{r.solvedCount}</td>
                  <td className="border border-ink-600 px-2 py-1.5 text-center font-bold text-[var(--color-brand)]">
                    {r.score}
                  </td>
                  <td className="border border-ink-600 px-2 py-1.5 text-center text-fg-muted">
                    {r.totalMinutes}
                  </td>
                  {labels.map((l) => (
                    <td
                      key={l}
                      className={`border border-ink-600 px-2 py-1.5 text-center ${
                        byLabel.has(l) ? 'font-bold text-[var(--color-ac)]' : 'text-ink-500'
                      }`}
                    >
                      {byLabel.has(l) ? `+${byLabel.get(l)}` : '-'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
