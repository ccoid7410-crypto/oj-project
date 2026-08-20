import { useState, useEffect } from 'react';
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

export function PatchNotesPage() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetch('/api/patch-notes')
      .then((res) => {
        if (!res.ok) throw new Error('패치노트를 불러오지 못했습니다.');
        return res.json();
      })
      .then((data) => {
        setCommits(data);
        setLoading(false);
      })
      .catch((err) => {
        setErrorMsg(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl flex flex-col items-start gap-8 px-4 py-8">
      <Link
        to="/"
        className="flex items-center gap-2 text-sm font-semibold text-fg-muted hover:text-fg transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 19-7-7 7-7"/>
          <path d="M19 12H5"/>
        </svg>
        홈으로 돌아가기
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-fg flex items-center gap-3">
          <span className="text-[var(--color-brand)]">✦</span> 전체 업데이트 내역
        </h1>
        <p className="text-fg-muted">
          두루누리 OJ의 패치노트와 신규 기능 추가, 버그 수정 내역입니다.
        </p>
      </div>

      {loading ? (
        <div className="w-full flex justify-center py-12">
          <div className="animate-pulse flex space-x-4">
            <div className="rounded-full bg-ink-200 h-10 w-10"></div>
            <div className="flex-1 space-y-6 py-1">
              <div className="h-2 bg-ink-200 rounded"></div>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-2 bg-ink-200 rounded col-span-2"></div>
                  <div className="h-2 bg-ink-200 rounded col-span-1"></div>
                </div>
                <div className="h-2 bg-ink-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      ) : errorMsg ? (
        <div className="w-full bg-red-500/10 text-red-500 p-6 rounded-2xl text-center font-bold">
          {errorMsg}
        </div>
      ) : (
        <>
        <div className="w-full relative border-l-[3px] border-[var(--color-ink-200)] ml-4 pl-8 py-4 flex flex-col gap-12 mt-4">
        {commits.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((c) => {
          const dateStr = new Date(c.commit.author.date).toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          const parts = c.commit.message.split('\n\n');
          const title = parts[0];
          const description = parts.length > 1 ? parts.slice(1).join('\n\n') : null;
          
          const isToday = new Date(c.commit.author.date).toDateString() === new Date().toDateString();

          return (
            <div key={c.sha} className="relative group">
              {/* Timeline Dot */}
              <div className="absolute -left-[43.5px] top-1.5 h-[20px] w-[20px] rounded-full bg-[var(--color-white)] border-[4px] border-[var(--color-ink-300)] group-hover:border-[var(--color-brand)] transition-colors shadow-sm" />
              
              <div className="flex flex-col gap-2 bg-[var(--color-white)] p-6 rounded-2xl border border-[var(--color-ink-200)] shadow-sm group-hover:shadow-md transition-shadow dark:bg-[var(--color-ink-900)]">
                <span className="text-sm font-bold text-[var(--color-brand)] tracking-wide flex items-center gap-2">
                  {dateStr}
                  {isToday && (
                    <span className="bg-brand/10 text-brand px-2 py-0.5 rounded text-xs font-black uppercase tracking-wider">
                      NEW
                    </span>
                  )}
                </span>
                <h3 className="text-xl font-bold text-fg leading-tight mt-1">{title}</h3>
                
                {description && (
                  <pre className="mt-2 text-sm text-fg-muted whitespace-pre-wrap font-sans bg-[var(--color-ink-50)] dark:bg-[var(--color-ink-800)] p-4 rounded-lg">
                    {description}
                  </pre>
                )}
                
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-fg-muted bg-[var(--color-ink-100)] dark:bg-[var(--color-ink-800)] px-3 py-1 rounded-full">
                    {c.commit.author.name}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
        {Math.ceil(commits.length / pageSize) > 1 && (
          <div className="w-full flex justify-center items-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg font-bold bg-[var(--color-ink-100)] text-fg disabled:opacity-50 hover:bg-[var(--color-ink-200)] transition-colors"
            >
              이전
            </button>
            <span className="px-4 py-2 text-fg-muted font-bold">
              {currentPage} / {Math.ceil(commits.length / pageSize)}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(commits.length / pageSize), p + 1))}
              disabled={currentPage === Math.ceil(commits.length / pageSize)}
              className="px-4 py-2 rounded-lg font-bold bg-[var(--color-ink-100)] text-fg disabled:opacity-50 hover:bg-[var(--color-ink-200)] transition-colors"
            >
              다음
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
}
