import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { ClassSummary } from '../../api/types';

export function ClassListPage() {
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);

  useEffect(() => {
    api.get<ClassSummary[]>('/classes').then(setClasses);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">내 수업</h1>
      {classes && classes.length === 0 && (
        <p className="mt-10 text-sm text-fg-muted">아직 등록된 수업이 없습니다. 관리자에게 등록을 요청하세요.</p>
      )}
      {classes && classes.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {classes.map((c) => (
            <li key={c.id} className="rounded border border-ink-500 p-3 text-sm hover:border-[var(--color-brand)]">
              <Link to={`/classes/${c.slug}`} className="font-bold hover:text-[var(--color-brand)]">
                {c.name}
              </Link>
              <p className="mt-1 text-xs text-fg-muted">
                {c.description || '설명 없음'} · 문제 {c.problemCount}개 · 학생 {c.memberCount}명
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
