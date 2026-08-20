import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Commit {
  sha: string;
  commit: {
    author: {
      name: string;
      date: string;
    };
    message: string;
  };
  html_url: string;
}

export function PatchNotes() {
  // GitHub API Rate Limit(시간당 60회) 문제를 우회하기 위해 우선 아름다운 UI 확인용 Mock 데이터를 사용합니다.
  // 추후 백엔드에 GitHub Token을 등록하여 /api/patch-notes API를 만드는 방식을 추천합니다.
  const [commits] = useState<Commit[]>([
    {
      sha: '1',
      commit: { author: { name: 'jihun', date: new Date(Date.now() - 1000 * 60 * 25).toISOString() }, message: 'feat(editor): improve toolbar UI and styling features\n\n- Add rainbow easter egg\n- Improve color palette' },
      html_url: 'https://github.com/ccoid7410-crypto/oj-project/commits/main'
    },
    {
      sha: '2',
      commit: { author: { name: 'HENRY KIM', date: new Date(Date.now() - 86400000 - 1000 * 60 * 60 * 4).toISOString() }, message: 'feat: add editable exam scope cards' },
      html_url: 'https://github.com/ccoid7410-crypto/oj-project/commits/main'
    },
    {
      sha: '3',
      commit: { author: { name: 'HENRY KIM', date: new Date(Date.now() - 86400000 * 2 - 1000 * 60 * 60 * 11 - 1000 * 60 * 15).toISOString() }, message: 'feat: add community exam scope page' },
      html_url: 'https://github.com/ccoid7410-crypto/oj-project/commits/main'
    }
  ]);
  const [loading] = useState(false);
  const [errorMsg] = useState<string | null>(null);

  useEffect(() => {
    // 임시로 API 호출은 주석 처리합니다 (Rate Limit 방지)
    /*
    fetch('https://api.github.com/repos/ccoid7410-crypto/oj-project/commits?per_page=3')
    ...
    */
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 w-full">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-fg flex items-center gap-2">
            🚀 최근 업데이트
          </h2>
        </div>
        <div className="animate-pulse flex flex-col gap-6 border-l-2 border-ink-200 ml-2 pl-6 py-2">
          <div className="h-10 w-full rounded bg-ink-100"></div>
          <div className="h-10 w-full rounded bg-ink-100"></div>
          <div className="h-10 w-full rounded bg-ink-100"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[320px] rounded-2xl bg-[var(--color-white)]/80 backdrop-blur-xl border border-[var(--color-ink-200)] p-6 shadow-xl shadow-black/5 dark:shadow-black/40 relative overflow-hidden transition-all hover:shadow-2xl hover:border-[var(--color-ink-300)] flex flex-col gap-5">
      {/* 럭셔리한 배경 그라데이션 장식 */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-[var(--color-brand)]/10 blur-3xl rounded-full pointer-events-none transition-transform duration-700 group-hover:scale-150"></div>
      
      <div className="flex items-center justify-between border-b border-[var(--color-ink-200)] pb-4 z-10">
        <h2 className="text-lg font-black text-fg flex items-center gap-2 tracking-tight">
          <span className="text-[var(--color-brand)]">✦</span> 최근 업데이트
        </h2>
        <Link
          to="/patch-notes"
          className="text-xs font-bold text-[var(--color-brand)] hover:text-[var(--color-brand-dim)] transition-colors flex items-center bg-[var(--color-brand)]/10 px-2 py-1 rounded-full"
        >
          전체 보기 &gt;
        </Link>
      </div>
      
      <div className="relative border-l-2 border-[var(--color-ink-200)] ml-2 pl-6 py-2 flex flex-col gap-7 z-10">
        {commits.map((c) => {
          const dateStr = new Date(c.commit.author.date).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
          });
          const title = c.commit.message.split('\n')[0];

          return (
            <div key={c.sha} className="relative group">
              {/* 타임라인 고급 닷(Dot) 마커 */}
              <div className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full bg-[var(--color-white)] border-[3px] border-[var(--color-ink-300)] group-hover:border-[var(--color-brand)] group-hover:bg-[var(--color-brand)]/20 transition-all duration-300 shadow-sm" />
              
              <div className="flex flex-col gap-1.5 transform transition-transform duration-300 group-hover:translate-x-1">
                <span className="text-[11px] font-bold text-[var(--color-brand)] tracking-wide uppercase">{dateStr}</span>
                <span className="text-[14px] font-semibold text-fg leading-tight break-keep group-hover:text-[var(--color-brand)] transition-colors">
                  {title}
                </span>
              </div>
            </div>
          );
        })}
        {errorMsg ? (
          <p className="text-sm text-red-500 font-medium bg-red-500/10 p-3 rounded-lg">{errorMsg}</p>
        ) : commits.length === 0 ? (
          <p className="text-sm text-fg-muted">업데이트 내역이 없습니다.</p>
        ) : null}
      </div>
    </div>
  );
}
