import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

// club-homepage/js/hall-of-fame.js의 React 버전. 백엔드 GET /users/hall-of-fame는
// 로그인만 하면 누구나 조회 가능하다(부원 여부는 더 이상 안 따짐 - oj-backend
// users.controller.ts의 "로그인한 사용자면 누구나 볼 수 있다" 코멘트 참고).
// 이 라우트 자체가 AccessGate level="login"으로 감싸여 있으므로 여기 도달했다면
// 이미 로그인 상태다 - 원본의 401/403 분기는 지금 백엔드 기준으로는 발생하지 않는다.

interface HallOfFameMember {
  username: string;
  name: string | null;
}

interface HallOfFameGroup {
  generation: string;
  members: HallOfFameMember[];
}

export function HallOfFamePage() {
  const [groups, setGroups] = useState<HallOfFameGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<HallOfFameGroup[]>('/users/hall-of-fame')
      .then(setGroups)
      .catch(() => setError('목록을 불러오지 못했습니다. 잠시 후 새로고침 해주세요.'));
  }, []);

  return (
    <section>
      <h2 className="text-lg font-bold text-fg">명예의 전당</h2>
      <p className="mt-1 text-sm text-fg-muted">두루누리에 함께한 회원들입니다. 이름을 누르면 OJ 프로필로 이동합니다.</p>

      <div className="mt-6 flex flex-col gap-8">
        {error && <p className="text-sm text-[var(--color-wa)]">{error}</p>}
        {!error && groups === null && <p className="text-sm text-fg-muted">불러오는 중...</p>}
        {!error && groups !== null && groups.length === 0 && (
          <p className="text-sm text-fg-muted">아직 등록된 회원이 없습니다.</p>
        )}
        {groups?.map((group) => (
          <div key={group.generation}>
            <h3 className="flex items-center gap-2 text-base font-bold text-fg">
              {group.generation === '기타' ? '기타' : `${group.generation}기`}
              <span className="text-xs font-normal text-fg-muted">{group.members.length}명</span>
            </h3>
            <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
              {group.members.map((member) => (
                <li key={member.username}>
                  <Link
                    to={`/users/${encodeURIComponent(member.username)}`}
                    className="flex flex-col rounded border border-ink-600 px-3 py-2 hover:border-[var(--color-brand)]"
                  >
                    <span className="text-sm font-bold text-fg">{member.name ?? member.username}</span>
                    <span className="text-xs text-fg-muted">{member.username}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
