import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import type { StudentIdWindow } from '../../api/types';

function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function StudentIdAdminPage() {
  const [editWindow, setEditWindow] = useState<StudentIdWindow | null>(null);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [savingWindow, setSavingWindow] = useState(false);
  const [windowError, setWindowError] = useState<string | null>(null);

  function loadWindow() {
    api.get<StudentIdWindow>('/admin/student-id/window').then((w) => {
      setEditWindow(w);
      setStartsAt(toLocalInputValue(w.startsAt));
      setEndsAt(toLocalInputValue(w.endsAt));
    });
  }

  useEffect(loadWindow, []);

  async function onSaveWindow(e: FormEvent) {
    e.preventDefault();
    setSavingWindow(true);
    setWindowError(null);
    try {
      await api.put('/admin/student-id/window', {
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      });
      loadWindow();
    } catch (err) {
      setWindowError(err instanceof ApiError ? err.message : '저장에 실패했습니다.');
    } finally {
      setSavingWindow(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-sm font-bold text-fg-muted">학번 수정 허용 기간</h2>
        <p className="mt-1 text-xs text-fg-muted">
          이미 학번을 등록한 유저는 이 기간에만 학번을 바꿀 수 있습니다. (최초 등록은 언제든 가능)
        </p>
        {editWindow && (
          <p className="mt-1 text-xs">
            현재 상태:{' '}
            <span className={`font-bold ${editWindow.isOpen ? 'text-[var(--color-ac)]' : 'text-fg-muted'}`}>
              {editWindow.isOpen ? '열림' : '닫힘'}
            </span>
          </p>
        )}
        <form onSubmit={onSaveWindow} className="mt-2 flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            시작
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="rounded border border-ink-500 bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-brand)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            종료
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="rounded border border-ink-500 bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-brand)]"
            />
          </label>
          <button
            type="submit"
            disabled={savingWindow}
            className="rounded bg-[var(--color-brand)] px-3 py-1.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
          >
            {savingWindow ? '저장 중...' : '저장'}
          </button>
        </form>
        {windowError && <p className="mt-2 text-xs text-[var(--color-wa)]">{windowError}</p>}
      </section>
    </div>
  );
}
