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
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isMinimized, setIsMinimized] = useState(() => {
    const saved = localStorage.getItem('patchNotesMinimized');
    return saved === 'true';
  });

  const toggleMinimize = () => {
    setIsMinimized(prev => {
      const next = !prev;
      localStorage.setItem('patchNotesMinimized', String(next));
      return next;
    });
  };

  useEffect(() => {
    fetch('/api/patch-notes')
      .then((res) => {
        if (!res.ok) throw new Error('불러오기 실패');
        return res.json();
      })
      .then((data) => {
        // 사이드바에는 최신 3개만 표시
        setCommits(data.slice(0, 3));
        setLoading(false);
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setLoading(false);
      });
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

  if (isMinimized) {
    const hasTodayCommit = commits.some(c => new Date(c.commit.author.date).toDateString() === new Date().toDateString());
    return (
      <button 
        onClick={toggleMinimize}
        className="w-14 h-14 rounded-full bg-[var(--color-white)]/80 backdrop-blur-xl border border-[var(--color-ink-200)] shadow-xl flex items-center justify-center hover:scale-110 hover:border-[var(--color-brand)] transition-all relative group dark:bg-[var(--color-ink-900)] cursor-pointer"
        title="최근 업데이트 보기"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fg-muted group-hover:text-fg transition-colors">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <line x1="10" y1="9" x2="8" y2="9"/>
        </svg>
        {hasTodayCommit && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-brand)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-[var(--color-brand)] border-2 border-[var(--color-white)]"></span>
          </span>
        )}
      </button>
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
        <div className="flex items-center gap-2">
          <Link
            to="/patch-notes"
            className="text-xs font-bold text-[var(--color-brand)] hover:text-[var(--color-brand-dim)] transition-colors flex items-center bg-[var(--color-brand)]/10 px-2 py-1 rounded-full"
          >
            전체 보기 &gt;
          </Link>
          <button
            onClick={toggleMinimize}
            className="p-1 rounded hover:bg-[var(--color-ink-100)] text-fg-muted hover:text-fg transition-colors"
            title="숨기기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div className="relative border-l-2 border-[var(--color-ink-200)] ml-2 pl-6 py-2 flex flex-col gap-7 z-10">
        {commits.map((c) => {
          const dateStr = new Date(c.commit.author.date).toLocaleDateString('ko-KR', {
            timeZone: 'Asia/Seoul',
            month: 'short',
            day: 'numeric',
          });
          const title = c.commit.message.split('\n')[0];
          
          const isToday = new Date(c.commit.author.date).toDateString() === new Date().toDateString();

          return (
            <div key={c.sha} className="relative group">
              {/* 타임라인 고급 닷(Dot) 마커 */}
              <div className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full bg-[var(--color-white)] border-[3px] border-[var(--color-ink-300)] group-hover:border-[var(--color-brand)] group-hover:bg-[var(--color-brand)]/20 transition-all duration-300 shadow-sm" />
              
              <div className="flex flex-col gap-1.5 transform transition-transform duration-300 group-hover:translate-x-1">
                <span className="text-[11px] font-bold text-[var(--color-brand)] tracking-wide uppercase flex items-center gap-1.5">
                  {dateStr}
                  {isToday && (
                    <span className="bg-brand/10 text-brand px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider">
                      NEW
                    </span>
                  )}
                </span>
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
