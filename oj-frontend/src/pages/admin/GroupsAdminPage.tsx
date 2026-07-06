import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import type { AdminUser, Group, GroupMember } from '../../api/types';

const inputClass =
  'rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]';

export function GroupsAdminPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    api.get<Group[]>('/admin/groups').then(setGroups).catch(() => setError('그룹 목록을 불러오지 못했습니다.'));
  }

  useEffect(load, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/admin/groups', { name });
      setName('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '그룹 생성에 실패했습니다.');
    }
  }

  async function onRemove(id: string) {
    if (!confirm('이 그룹을 삭제할까요? (멤버는 그룹만 해제되고 계정은 그대로 남습니다)')) return;
    await api.delete(`/admin/groups/${id}`);
    load();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">그룹 관리</h1>
      <p className="mt-1 text-xs text-fg-muted">
        랭킹/통계를 반별로 필터링하기 위한 가벼운 사용자 묶음입니다. 전용 문제집이 필요하면 "수업 관리"를 쓰세요.
      </p>

      <form onSubmit={onCreate} className="mt-4 flex gap-2">
        <input
          required
          placeholder="그룹 이름 (예: 1반)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${inputClass} flex-1`}
        />
        <button
          type="submit"
          className="rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)]"
        >
          그룹 생성
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-[var(--color-wa)]">{error}</p>}

      <ul className="mt-6 flex flex-col gap-2">
        {groups.map((g) => (
          <li key={g.id} className="rounded border border-ink-500 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-bold">
                {g.name} <span className="text-xs text-fg-muted">(멤버 {g.memberCount}명)</span>
              </span>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                  className="rounded border border-ink-500 px-2 py-1 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                >
                  {expandedId === g.id ? '닫기' : '멤버 관리'}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(g.id)}
                  className="rounded border border-ink-500 px-2 py-1 hover:border-[var(--color-wa)] hover:text-[var(--color-wa)]"
                >
                  삭제
                </button>
              </div>
            </div>
            {expandedId === g.id && <GroupMembersEditor groupId={g.id} onChanged={load} />}
          </li>
        ))}
        {groups.length === 0 && <p className="text-sm text-fg-muted">아직 만든 그룹이 없습니다.</p>}
      </ul>
    </div>
  );
}

function GroupMembersEditor({ groupId, onChanged }: { groupId: string; onChanged: () => void }) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUser[]>([]);

  function loadMembers() {
    api.get<GroupMember[]>(`/admin/groups/${groupId}/members`).then(setMembers);
  }

  useEffect(loadMembers, [groupId]);

  async function search() {
    setResults(await api.get<AdminUser[]>(`/admin/users/search?q=${encodeURIComponent(query)}`));
  }

  async function addMember(userId: string) {
    await api.post(`/admin/groups/${groupId}/members`, { userId });
    loadMembers();
    onChanged();
  }

  async function removeMember(userId: string) {
    await api.delete(`/admin/groups/${groupId}/members/${userId}`);
    loadMembers();
    onChanged();
  }

  return (
    <div className="mt-3 rounded border border-ink-500 bg-ink-700 p-3">
      <p className="text-xs font-bold">현재 멤버</p>
      <ul className="mt-1 flex flex-wrap gap-1">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-1 rounded bg-white px-2 py-1 text-xs">
            {m.username}
            <button type="button" onClick={() => removeMember(m.id)} className="text-fg-muted hover:text-[var(--color-wa)]">
              ×
            </button>
          </li>
        ))}
        {members.length === 0 && <p className="text-xs text-fg-muted">아직 멤버가 없습니다.</p>}
      </ul>

      <div className="mt-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="사용자명/이메일 검색"
          className={`${inputClass} flex-1 text-xs`}
        />
        <button
          type="button"
          onClick={search}
          className="rounded border border-ink-500 px-2 py-1 text-xs hover:border-[var(--color-brand)]"
        >
          검색
        </button>
      </div>
      {results.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {results.map((u) => (
            <li key={u.id} className="flex items-center justify-between text-xs">
              <span>
                {u.username} ({u.email})
              </span>
              <button
                type="button"
                onClick={() => addMember(u.id)}
                className="rounded border border-ink-500 px-2 py-0.5 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
              >
                추가
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
