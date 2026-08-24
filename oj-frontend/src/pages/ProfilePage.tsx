import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { MySubmission, UserProfile } from '../api/types';
import { Avatar } from '../components/Avatar';
import { bannerUrl } from '../lib/avatar';
import { DifficultyBadge } from '../components/DifficultyBadge';
import { useAuth } from '../context/AuthContext';
import { UserTitleBadge } from '../components/UserTitleBadge';
import { VerdictBadge } from '../components/VerdictBadge';
import { ProfileWebsiteLink } from '../components/ProfileWebsiteLink';

// KaTeX(수식) 번들이 커서 소개(bio)가 있을 때만 lazy load 한다.
const MarkdownView = lazy(() =>
  import('../components/MarkdownView').then((m) => ({ default: m.MarkdownView })),
);

const ROLE_LABEL: Record<string, string> = {
  ADMIN: '관리자',
  DEV: '개발자',
  TEACHER: '선생님',
  MEMBER: '부원',
  USER: '일반 회원',
};

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    api
      .get<UserProfile>(`/users/${username}`)
      .then(setProfile)
      .catch(() => setError('유저를 찾을 수 없습니다.'));
  }, [username]);

  if (error) return <p className="text-sm text-[var(--color-wa)]">{error}</p>;
  if (!profile) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  // 본인 프로필에서만 이름·학번을 추가로 보여준다(개인정보라 남에게는 안 보인다).
  const isSelf = user?.username === profile.username;
  const banner = bannerUrl(profile.username, profile.bannerVersion);

  return (
    <div>
      {banner && (
        <img
          src={banner}
          alt={`${profile.username} 배너`}
          className="mb-4 h-40 w-full rounded border border-ink-600 object-cover"
        />
      )}
      <div className="flex items-center gap-3">
        <Avatar username={profile.username} avatarVersion={profile.avatarVersion} size={56} />
        <div>
          <div className="flex items-center gap-3">
            <UserTitleBadge title={profile.customTitle} />
            <h1 className="text-2xl font-bold">{profile.username}</h1>
          </div>
          {profile.websites.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.websites.map((site) => (
                <ProfileWebsiteLink key={site} site={site} />
              ))}
            </div>
          )}
        </div>
      </div>

      {profile.bio && (
        <Suspense
          fallback={
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg">{profile.bio}</p>
          }
        >
          <MarkdownView content={profile.bio} className="mt-3 text-fg" />
        </Suspense>
      )}

      <div className="mt-4 grid grid-cols-3 rounded border border-ink-500">
        <div className="px-4 py-3">
          <div className="text-xs text-fg-muted">레이팅</div>
          <div className="mt-0.5 text-[22px] font-black text-[var(--color-brand)]">{profile.rating}</div>
        </div>
        <div className="border-l border-ink-500 px-4 py-3">
          <div className="text-xs text-fg-muted">랭킹</div>
          <div className="mt-0.5 text-[22px] font-black text-fg">{profile.rank ? `#${profile.rank}` : '-'}</div>
        </div>
        <div className="border-l border-ink-500 px-4 py-3">
          <div className="text-xs text-fg-muted">해결한 문제</div>
          <div className="mt-0.5 text-[22px] font-black text-fg">{profile.solvedCount}</div>
        </div>
      </div>

      {/* 계정 정보. 기수·권한·가입일은 모두에게, 이름·학번은 본인에게만. */}
      <div className="mt-4 rounded border border-ink-500 p-3 text-xs">
        <p className="font-bold text-fg">계정 정보</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
          <Info label="기수" value={profile.generation ? `${profile.generation}기` : '-'} />
          <Info label="권한" value={ROLE_LABEL[profile.role] ?? profile.role} />
          <Info label="가입일" value={new Date(profile.createdAt).toLocaleDateString('ko-KR')} />
          {isSelf && <Info label="이름" value={user?.name || '-'} />}
          {isSelf && <Info label="입학년도+학번" value={user?.studentId || '-'} />}
        </dl>
        {isSelf && (
          <Link to="/settings" className="mt-3 inline-block text-fg-muted underline hover:text-[var(--color-brand)]">
            설정에서 수정
          </Link>
        )}
      </div>

      {/* 다른 유저의 제출 목록을 볼 수 있는 공개 API가 없어(/submissions/me는 본인 전용),
          본인 프로필에서만 최근 제출을 보여준다 - 없는 데이터를 꾸며내지 않는다. */}
      {isSelf && <RecentSubmissionsSection />}

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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-fg-muted">{label}</dt>
      <dd className="font-medium text-fg">{value}</dd>
    </div>
  );
}

function RecentSubmissionsSection() {
  const [submissions, setSubmissions] = useState<MySubmission[] | null>(null);

  useEffect(() => {
    api.get<MySubmission[]>('/submissions/me?limit=10').then(setSubmissions);
  }, []);

  if (!submissions || submissions.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="border-b border-ink-500 pb-1 text-base font-bold">최근 제출</h2>
      <table className="mt-3 w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="bg-ink-700 text-fg-muted">
            <th className="border border-ink-600 px-2 py-1.5 font-medium">결과</th>
            <th className="border border-ink-600 px-3 py-1.5 font-medium">문제</th>
            <th className="border border-ink-600 px-2 py-1.5 font-medium">언어</th>
            <th className="border border-ink-600 px-2 py-1.5 font-medium">제출한 시간</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => (
            <tr key={s.id} className="hover:bg-ink-700/60">
              <td className="border border-ink-600 px-2 py-1.5">
                <Link to={`/submissions/${s.id}`}>
                  <VerdictBadge status={s.status} showPulse={false} />
                </Link>
              </td>
              <td className="border border-ink-600 px-3 py-1.5 text-fg-muted">
                {s.problem ? (
                  <Link to={`/problems/${s.problem.slug}`} className="hover:text-[var(--color-brand)]">
                    {s.problem.displayId}. {s.problem.title}
                  </Link>
                ) : (
                  '-'
                )}
              </td>
              <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">{s.language}</td>
              <td className="border border-ink-600 px-2 py-1.5 text-fg-muted">
                {new Date(s.createdAt).toLocaleString('ko-KR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
