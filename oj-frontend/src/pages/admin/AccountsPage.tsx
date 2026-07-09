import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import type { AdminUser, Role } from '../../api/types';
import { useAuth } from '../../context/AuthContext';

const ROLE_LABEL: Record<Role, string> = { USER: '일반', MEMBER: '부원', ADMIN: '관리자' };

export function AccountsPage() {
  const { user: me } = useAuth();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState<Record<string, string>>({});

  function load() {
    api
      .get<AdminUser[]>(`/admin/users/search?q=${encodeURIComponent(query)}`)
      .then(setUsers)
      .catch(() => setError('계정 목록을 불러오지 못했습니다.'));
  }

  useEffect(load, []);

  async function ban(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/admin/users/${id}/ban`, { reason: banReason[id] ?? '' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '정지에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  async function unban(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/admin/users/${id}/unban`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '정지 해제에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  }

  async function setRole(id: string, username: string, role: Role) {
    if (!window.confirm(`${username} 계정의 권한을 '${ROLE_LABEL[role]}'(으)로 변경할까요?`)) {
      load(); // 취소 시 select 표시를 원래 값으로 되돌리기 위해 다시 불러온다
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/admin/users/${id}/role`, { role });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '권한 변경에 실패했습니다.');
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="flex items-center gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="username 또는 email로 검색"
          className="w-64 rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
        />
        <button
          type="submit"
          className="rounded border border-ink-500 px-3 py-2 text-sm hover:border-[var(--color-brand)]"
        >
          검색
        </button>
      </form>

      {error && <p className="mt-3 text-xs text-[var(--color-wa)]">{error}</p>}

      {users && users.length === 0 && <p className="mt-8 text-sm text-fg-muted">결과가 없습니다.</p>}

      {users && users.length > 0 && (
        <table className="mt-4 w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-ink-700 text-fg-muted">
              <th className="border border-ink-600 px-2 py-1.5 font-medium">username</th>
              <th className="border border-ink-600 px-2 py-1.5 font-medium">email</th>
              <th className="w-16 border border-ink-600 px-2 py-1.5 font-medium">권한</th>
              <th className="w-20 border border-ink-600 px-2 py-1.5 text-center font-medium">레이팅</th>
              <th className="w-24 border border-ink-600 px-2 py-1.5 font-medium">상태</th>
              <th className="border border-ink-600 px-2 py-1.5 font-medium">조치</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="border border-ink-600 px-2 py-1.5 font-medium">{u.username}</td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">{u.email}</td>
                <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">{ROLE_LABEL[u.role] ?? u.role}</td>
                <td className="border border-ink-600 px-2 py-1.5 text-center text-fg-muted">{u.rating}</td>
                <td
                  className={`border border-ink-600 px-2 py-1.5 font-bold ${
                    u.banned ? 'text-[var(--color-wa)]' : 'text-[var(--color-ac)]'
                  }`}
                >
                  {u.banned ? `정지됨${u.bannedReason ? ` (${u.bannedReason})` : ''}` : '활성'}
                </td>
                <td className="border border-ink-600 px-2 py-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {me?.username === u.username ? (
                      <span className="text-xs text-fg-muted">본인 계정</span>
                    ) : (
                      <select
                        value={u.role}
                        disabled={busyId === u.id}
                        onChange={(e) => setRole(u.id, u.username, e.target.value as Role)}
                        className="rounded border border-ink-500 bg-white px-1.5 py-1 text-xs outline-none focus:border-[var(--color-brand)] disabled:opacity-60"
                      >
                        <option value="USER">일반</option>
                        <option value="MEMBER">부원</option>
                        <option value="ADMIN">관리자</option>
                      </select>
                    )}
                    {u.role !== 'ADMIN' &&
                      (u.banned ? (
                        <button
                          onClick={() => unban(u.id)}
                          disabled={busyId === u.id}
                          className="rounded border border-ink-500 px-2 py-1 text-xs hover:border-[var(--color-brand)] disabled:opacity-60"
                        >
                          정지 해제
                        </button>
                      ) : (
                        <>
                          <input
                            value={banReason[u.id] ?? ''}
                            onChange={(e) => setBanReason((prev) => ({ ...prev, [u.id]: e.target.value }))}
                            placeholder="정지 사유"
                            className="w-32 rounded border border-ink-500 px-1.5 py-1 text-xs outline-none focus:border-[var(--color-brand)]"
                          />
                          <button
                            onClick={() => ban(u.id)}
                            disabled={busyId === u.id}
                            className="rounded border border-[var(--color-wa)] px-2 py-1 text-xs font-bold text-[var(--color-wa)] hover:bg-[var(--color-wa)]/10 disabled:opacity-60"
                          >
                            정지
                          </button>
                        </>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
