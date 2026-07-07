import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import type { BulkRosterResult, ClubRosterEntry, StudentIdWindow } from '../../api/types';

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

  const [roster, setRoster] = useState<ClubRosterEntry[] | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState<BulkRosterResult | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [addingRoster, setAddingRoster] = useState(false);

  function loadWindow() {
    api.get<StudentIdWindow>('/admin/student-id/window').then((w) => {
      setEditWindow(w);
      setStartsAt(toLocalInputValue(w.startsAt));
      setEndsAt(toLocalInputValue(w.endsAt));
    });
  }

  function loadRoster() {
    api.get<ClubRosterEntry[]>('/admin/student-id/roster').then(setRoster);
  }

  useEffect(loadWindow, []);
  useEffect(loadRoster, []);

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

  async function onAddRoster(e: FormEvent) {
    e.preventDefault();
    setAddingRoster(true);
    setRosterError(null);
    setBulkResult(null);
    try {
      // 한 줄에 "학번" 또는 "학번,이름" 형태로 붙여넣기
      const entries = bulkText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [studentId, name] = line.split(',').map((s) => s.trim());
          return { studentId, name: name || undefined };
        });
      const result = await api.post<BulkRosterResult>('/admin/student-id/roster', { entries });
      setBulkResult(result);
      setBulkText('');
      loadRoster();
    } catch (err) {
      setRosterError(err instanceof ApiError ? err.message : '등록에 실패했습니다.');
    } finally {
      setAddingRoster(false);
    }
  }

  async function removeEntry(id: string) {
    await api.delete(`/admin/student-id/roster/${id}`);
    loadRoster();
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

      <section>
        <h2 className="text-sm font-bold text-fg-muted">동아리 학번 명단</h2>
        <p className="mt-1 text-xs text-fg-muted">
          한 줄에 하나씩, <code className="font-mono">학번</code> 또는 <code className="font-mono">학번,이름</code>{' '}
          형태로 붙여넣으세요. 명단이 하나라도 있으면 이 명단에 있는 학번을 등록한 회원만 문제를 등록할 수 있습니다.
        </p>
        <form onSubmit={onAddRoster} className="mt-2 flex flex-col gap-2">
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={5}
            placeholder={'20240001,김철수\n20240002,이영희\n20240003'}
            className="rounded border border-ink-500 bg-white p-2 font-mono text-xs outline-none focus:border-[var(--color-brand)]"
          />
          <button
            type="submit"
            disabled={addingRoster || !bulkText.trim()}
            className="self-start rounded bg-[var(--color-brand)] px-3 py-1.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
          >
            {addingRoster ? '추가 중...' : '명단에 추가'}
          </button>
        </form>
        {rosterError && <p className="mt-2 text-xs text-[var(--color-wa)]">{rosterError}</p>}
        {bulkResult && (
          <p className="mt-2 text-xs text-fg-muted">
            추가 {bulkResult.addedCount}개
            {bulkResult.skippedCount > 0 && ` · 이미 있어서 건너뜀 ${bulkResult.skippedCount}개`}
          </p>
        )}

        {roster && roster.length > 0 && (
          <table className="mt-4 w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="bg-ink-700 text-fg-muted">
                <th className="border border-ink-600 px-2 py-1.5 font-medium">학번</th>
                <th className="border border-ink-600 px-2 py-1.5 font-medium">이름</th>
                <th className="border border-ink-600 px-2 py-1.5 font-medium">등록일</th>
                <th className="w-16 border border-ink-600 px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => (
                <tr key={r.id}>
                  <td className="border border-ink-600 px-2 py-1.5 font-mono">{r.studentId}</td>
                  <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">{r.name ?? '-'}</td>
                  <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">
                    {new Date(r.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="border border-ink-600 px-2 py-1.5 text-center">
                    <button
                      onClick={() => removeEntry(r.id)}
                      className="text-xs text-[var(--color-wa)] hover:underline"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {roster && roster.length === 0 && (
          <p className="mt-4 text-sm text-fg-muted">
            아직 등록된 학번이 없습니다. (명단이 비어 있으면 문제 등록 자격을 검증하지 않습니다)
          </p>
        )}
      </section>
    </div>
  );
}
