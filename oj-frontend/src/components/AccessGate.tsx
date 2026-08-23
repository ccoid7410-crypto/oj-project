import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isClubMember } from '../lib/clubMember';

/**
 * 페이지 접근 등급. 홈페이지(gate.js)와 같은 기준을 쓴다.
 *   'login'  - 로그인만 하면 됨(일반 회원도 가능)
 *   'member' - 동아리 부원(MEMBER) 또는 관리자만
 */
export type AccessLevel = 'login' | 'member';

/**
 * 페이지를 통째로 막을 때 쓰는 문구. 홈페이지(js/gate.js)와 문구를 맞춘다.
 * 제목뿐 아니라 아래 설명도 상황(등급 + 로그인 여부)마다 다르게 안내한다.
 *   login      - 로그인만 하면 되는 페이지
 *   memberAnon - 부원 전용인데 아직 로그인조차 안 한 경우
 *   member     - 부원 전용인데 로그인은 했지만 부원이 아닌 경우
 */
export const GATE_TEXT = {
  login: {
    title: '일반 회원 전용 공간입니다',
    message: '로그인한 회원만 이용할 수 있는 페이지입니다. 로그인 후 다시 시도해주세요.',
  },
  memberAnon: {
    title: '동아리 회원 전용 공간입니다',
    message: '동아리 부원만 볼 수 있는 페이지입니다. 부원 계정으로 로그인해주세요.',
  },
  member: {
    title: '동아리 회원 전용 공간입니다',
    message: '동아리 부원만 볼 수 있는 페이지입니다. 관리자에게 부원 등록을 요청해주세요.',
  },
} as const;

/** 버튼만 막을 때 쓰는 문구("제출하려면 로그인하세요"처럼 버튼 자리에 대신 표시). */
export function loginHint(action: string) {
  return `${action}하려면 로그인하세요`;
}

/**
 * 페이지 전체를 막는 안내 화면. 리다이렉트 대신 이 화면을 보여줘서
 * 왜 못 보는지 알 수 있게 한다(홈페이지 게이트와 같은 방식).
 */
export function AccessGateScreen({ level }: { level: AccessLevel }) {
  const location = useLocation();
  const { user } = useAuth();
  // 로그인조차 안 한 사람에게 "관리자에게 부원 등록을 요청"이라고 하면 안 되므로
  // 부원 전용 페이지도 로그인 여부에 따라 설명을 나눈다.
  const text = level === 'member' && !user ? GATE_TEXT.memberAnon : GATE_TEXT[level];
  const redirect = encodeURIComponent(location.pathname + location.search);

  return (
    <section className="mx-auto max-w-2xl py-10">
      <h2 className="text-lg font-bold">{text.title}</h2>
      <p className="mt-2 text-sm text-fg-muted">{text.message}</p>
      <div className="mt-5 flex gap-2">
        {user ? (
          <Link
            to="/"
            className="rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)]"
          >
            홈으로
          </Link>
        ) : (
          <>
            <Link
              to={`/login?redirect=${redirect}`}
              className="rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)]"
            >
              로그인
            </Link>
            <Link
              to="/signup"
              className="rounded border border-ink-500 px-4 py-2 text-sm font-bold hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              회원가입
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * 등급을 만족하지 못하면 안내 화면을, 만족하면 children을 보여준다.
 * 라우트 자체는 열어두고 내용만 가리므로 헤더의 탭은 그대로 남는다.
 */
export function AccessGate({
  level,
  children,
}: {
  level: AccessLevel;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  if (!user) return <AccessGateScreen level={level} />;
  if (level === 'member' && !isClubMember(user.role)) {
    return <AccessGateScreen level="member" />;
  }
  return <>{children}</>;
}
