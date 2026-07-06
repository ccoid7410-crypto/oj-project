import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { StudentIdWindow, UserProfile } from '../api/types';
import { DifficultyBadge } from '../components/DifficultyBadge';
import { useAuth } from '../context/AuthContext';

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!username) return;
    api
      .get<UserProfile>(`/users/${username}`)
      .then(setProfile)
      .catch(() => setError('유저를 찾을 수 없습니다.'));
  }

  useEffect(load, [username]);

  if (error) return <p className="text-sm text-[var(--color-wa)]">{error}</p>;
  if (!profile) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  const isSelf = user?.username === profile.username;

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{profile.username}</h1>
        {profile.role === 'ADMIN' && (
          <span className="rounded bg-[var(--color-brand)]/10 px-2 py-0.5 text-xs font-bold text-[var(--color-brand)]">
            ADMIN
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded border border-ink-500 bg-ink-500 text-center text-xs">
        <div className="bg-white px-2 py-3">
          <div className="text-fg-muted">레이팅</div>
          <div className="mt-0.5 text-lg font-bold text-[var(--color-brand)]">{profile.rating}</div>
        </div>
        <div className="bg-white px-2 py-3">
          <div className="text-fg-muted">랭킹</div>
          <div className="mt-0.5 text-lg font-bold">{profile.rank ? `#${profile.rank}` : '-'}</div>
        </div>
        <div className="bg-white px-2 py-3">
          <div className="text-fg-muted">해결한 문제</div>
          <div className="mt-0.5 text-lg font-bold">{profile.solvedCount}</div>
        </div>
      </div>

      {isSelf && <StudentIdSection onUpdated={() => refreshUser().then(load)} />}

      <h2 className="mt-8 border-b border-ink-500 pb-1 text-base font-bold">푼 문제 (난이도 높은 순)</h2>
      {profile.solvedProblems.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">아직 푼 문제가 없습니다.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {profile.solvedProblems.map((p) => (
            <li key={p.id}>
              <Link
                to={`/problems/${p.slug}`}
                className="flex items-center gap-1.5 rounded border border-ink-600 px-2 py-1 text-xs hover:border-[var(--color-brand)]"
              >
                <DifficultyBadge level={p.level} />
                <span className="text-fg-muted">{p.displayId}</span>
                <span>{p.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StudentIdSection({ onUpdated }: { onUpdated: () => void }) {
  const { user } = useAuth();
  const [window, setWindow] = useState<StudentIdWindow | null>(null);
  const [studentId, setStudentId] = useState(user?.studentId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api.get<StudentIdWindow>('/users/me/student-id-window').then(setWindow);
  }, []);

  const hasStudentId = !!user?.studentId;
  const canEdit = !hasStudentId || (window?.isOpen ?? false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await api.patch('/users/me/student-id', { studentId });
      setNotice('학번이 저장됐습니다.');
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '학번 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 rounded border border-ink-500 p-3 text-xs">
      <p className="font-bold text-fg">학번</p>
      {!hasStudentId && <p className="mt-1 text-fg-muted">아직 등록된 학번이 없습니다. 최초 등록은 언제든 가능합니다.</p>}
      {hasStudentId && !window?.isOpen && (
        <p className="mt-1 text-fg-muted">
          현재 학번: <span className="font-bold text-fg">{user?.studentId}</span> · 지금은 수정 기간이 아닙니다.
          {window?.startsAt && window?.endsAt && (
            <>
              {' '}
              (다음 수정 가능 기간: {new Date(window.startsAt).toLocaleString('ko-KR')} ~{' '}
              {new Date(window.endsAt).toLocaleString('ko-KR')})
            </>
          )}
        </p>
      )}
      {hasStudentId && window?.isOpen && (
        <p className="mt-1 text-[var(--color-ac)]">지금은 학번 수정 기간입니다.</p>
      )}

      {canEdit && (
        <form onSubmit={onSubmit} className="mt-2 flex items-center gap-2">
          <input
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="예: 20240001"
            className="w-40 rounded border border-ink-500 bg-white px-2 py-1.5 outline-none focus:border-[var(--color-brand)]"
          />
          <button
            type="submit"
            disabled={submitting || !studentId}
            className="rounded bg-[var(--color-brand)] px-3 py-1.5 font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
          >
            {submitting ? '저장 중...' : '저장'}
          </button>
        </form>
      )}
      {notice && <p className="mt-1 text-[var(--color-ac)]">{notice}</p>}
      {error && <p className="mt-1 text-[var(--color-wa)]">{error}</p>}
    </div>
  );
}
