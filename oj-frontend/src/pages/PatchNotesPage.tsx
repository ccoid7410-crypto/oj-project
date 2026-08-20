import { useState } from 'react';
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
  const [commits] = useState<Commit[]>([
    {
      sha: '1',
      commit: { author: { name: '최온유', date: new Date(Date.now() - 1000 * 60 * 25).toISOString() }, message: 'feat(editor): improve toolbar UI and styling features\n\n- Add rainbow easter egg\n- Improve color palette\n- Align text and formatting options' },
      html_url: 'https://github.com/ccoid7410-crypto/oj-project/commits/main'
    },
    {
      sha: '2',
      commit: { author: { name: 'HENRY KIM', date: new Date(Date.now() - 86400000 - 1000 * 60 * 60 * 4).toISOString() }, message: 'feat: add editable exam scope cards\n\n- Create ExamScopesModule\n- Frontend dynamic inputs' },
      html_url: 'https://github.com/ccoid7410-crypto/oj-project/commits/main'
    },
    {
      sha: '3',
      commit: { author: { name: 'HENRY KIM', date: new Date(Date.now() - 86400000 * 2 - 1000 * 60 * 60 * 11 - 1000 * 60 * 15).toISOString() }, message: 'feat: add community exam scope page' },
      html_url: 'https://github.com/ccoid7410-crypto/oj-project/commits/main'
    },
    {
      sha: '4',
      commit: { author: { name: 'HENRY KIM', date: new Date(Date.now() - 86400000 * 3 - 1000 * 60 * 60 * 2).toISOString() }, message: 'fix: hide saturday school holidays' },
      html_url: 'https://github.com/ccoid7410-crypto/oj-project/commits/main'
    },
    {
      sha: '5',
      commit: { author: { name: 'jihun', date: new Date(Date.now() - 86400000 * 4 - 1000 * 60 * 60 * 8 - 1000 * 60 * 42).toISOString() }, message: 'docs: update AGENTS.md instructions for AI' },
      html_url: 'https://github.com/ccoid7410-crypto/oj-project/commits/main'
    }
  ]);

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

      <div className="w-full relative border-l-[3px] border-[var(--color-ink-200)] ml-4 pl-8 py-4 flex flex-col gap-12 mt-4">
        {commits.map((c) => {
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

          return (
            <div key={c.sha} className="relative group">
              {/* Timeline Dot */}
              <div className="absolute -left-[43.5px] top-1.5 h-[20px] w-[20px] rounded-full bg-[var(--color-white)] border-[4px] border-[var(--color-ink-300)] group-hover:border-[var(--color-brand)] transition-colors shadow-sm" />
              
              <div className="flex flex-col gap-2 bg-[var(--color-white)] p-6 rounded-2xl border border-[var(--color-ink-200)] shadow-sm group-hover:shadow-md transition-shadow dark:bg-[var(--color-ink-900)]">
                <span className="text-sm font-bold text-[var(--color-brand)] tracking-wide">{dateStr}</span>
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
    </div>
  );
}
