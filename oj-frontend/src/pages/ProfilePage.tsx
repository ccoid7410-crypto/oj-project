import { lazy, Suspense, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Language, StudentIdWindow, UserProfile } from '../api/types';
import { LANGUAGE_OPTIONS } from '../lib/languages';
import { Avatar } from '../components/Avatar';
import { ThemeButtons } from '../components/ThemeButtons';
import { bannerUrl, fileToAvatarPayload, fileToBannerPayload } from '../lib/avatar';
import { DifficultyBadge } from '../components/DifficultyBadge';
import { useAuth } from '../context/AuthContext';
import { UserTitleBadge } from '../components/UserTitleBadge';

// KaTeX(수식) 번들이 커서 소개(bio)가 있을 때만 lazy load 한다.
const MarkdownView = lazy(() =>
  import('../components/MarkdownView').then((m) => ({ default: m.MarkdownView })),
);

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
            {profile.role === 'ADMIN' && (
              <span className="rounded bg-[var(--color-brand)]/10 px-2 py-0.5 text-xs font-bold text-[var(--color-brand)]">
                ADMIN
              </span>
            )}
          </div>
          {profile.websites.length > 0 && (
            <span className="flex flex-wrap gap-x-3">
              {profile.websites.map((site) => (
                <a
                  key={site}
                  href={site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-fg-muted underline hover:text-[var(--color-brand)]"
                >
                  {site}
                </a>
              ))}
            </span>
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

      {isSelf && <ProfileSettingsSection profile={profile} onUpdated={load} />}
      {isSelf && <AccountInfoSection />}
      {isSelf && <NameSection />}
      {isSelf && <StudentIdSection onUpdated={() => refreshUser().then(load)} />}
      {isSelf && <PreferredLanguageSection />}
      {isSelf && user?.role !== 'ADMIN' && <DeleteAccountSection />}

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

function DeleteAccountSection() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (
      !window.confirm(
        '정말 탈퇴할까요?\n제출 기록·댓글 등 모든 활동이 함께 삭제되며 되돌릴 수 없습니다.',
      )
    )
      return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/users/me/delete-account', { password });
      logout();
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '탈퇴에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 rounded border border-[var(--color-wa)]/40 p-3 text-xs">
      <p className="font-bold text-[var(--color-wa)]">회원 탈퇴</p>
      <p className="mt-1 text-fg-muted">
        계정과 모든 활동 기록(제출, 댓글 등)이 삭제되며 되돌릴 수 없습니다. 비밀번호를 입력해 확인해주세요.
      </p>
      <form onSubmit={onSubmit} className="mt-2 flex items-center gap-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="w-40 rounded border border-ink-500 bg-white px-2 py-1.5 outline-none focus:border-[var(--color-wa)]"
        />
        <button
          type="submit"
          disabled={submitting || !password}
          className="rounded bg-[var(--color-wa)] px-3 py-1.5 font-bold text-white hover:opacity-85 disabled:opacity-60"
        >
          {submitting ? '처리 중...' : '탈퇴'}
        </button>
      </form>
      {error && <p className="mt-2 text-[var(--color-wa)]">{error}</p>}
    </div>
  );
}

function PreferredLanguageSection() {
  const { user, refreshUser } = useAuth();
  const [language, setLanguage] = useState<Language | ''>(user?.preferredLanguage ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!language) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await api.patch('/users/me/preferred-language', { language });
      setNotice('기본 제출 언어가 저장됐습니다.');
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 rounded border border-ink-500 p-3 text-xs">
      <p className="font-bold text-fg">기본 제출 언어</p>
      <p className="mt-1 text-fg-muted">문제 페이지에서 이 언어가 자동으로 선택됩니다.</p>
      <form onSubmit={onSubmit} className="mt-2 flex items-center gap-2">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="w-40 rounded border border-ink-500 bg-white px-2 py-1.5 outline-none focus:border-[var(--color-brand)]"
        >
          <option value="" disabled>
            언어 선택
          </option>
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={submitting || !language}
          className="rounded bg-[var(--color-brand)] px-3 py-1.5 font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {submitting ? '저장 중...' : '저장'}
        </button>
      </form>
      {notice && <p className="mt-2 text-[var(--color-ac)]">{notice}</p>}
      {error && <p className="mt-2 text-[var(--color-wa)]">{error}</p>}
    </div>
  );
}

function NameSection() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await api.patch('/users/me/name', { name });
      setNotice('이름이 저장됐습니다.');
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '이름 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 rounded border border-ink-500 p-3 text-xs">
      <p className="font-bold text-fg">이름 (실명)</p>
      {!user?.name && <p className="mt-1 text-fg-muted">아직 등록된 이름이 없습니다.</p>}
      <form onSubmit={onSubmit} className="mt-2 flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          placeholder="예: 김철수"
          className="w-40 rounded border border-ink-500 bg-white px-2 py-1.5 outline-none focus:border-[var(--color-brand)]"
        />
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="rounded bg-[var(--color-brand)] px-3 py-1.5 font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {submitting ? '저장 중...' : '저장'}
        </button>
      </form>
      {notice && <p className="mt-2 text-[var(--color-ac)]">{notice}</p>}
      {error && <p className="mt-2 text-[var(--color-wa)]">{error}</p>}
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = { ADMIN: '관리자', MEMBER: '부원', USER: '일반 회원' };

/** 홈페이지 마이페이지에만 있던 정보(기수/권한/가입일/색상 설정)를 본인 프로필에도 노출한다. */
function AccountInfoSection() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="mt-4 rounded border border-ink-500 p-3 text-xs">
      <p className="font-bold text-fg">계정 정보</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        <div>
          <dt className="text-fg-muted">기수</dt>
          <dd className="font-medium text-fg">{user.generation ? `${user.generation}기` : '-'}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">권한</dt>
          <dd className="font-medium text-fg">{ROLE_LABEL[user.role] ?? user.role}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-fg-muted">가입일</dt>
          <dd className="font-medium text-fg">
            {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR') : '-'}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-fg-muted">색상 설정</p>
      <div className="mt-1.5">
        <ThemeButtons />
      </div>
    </div>
  );
}

function ProfileSettingsSection({ profile, onUpdated }: { profile: UserProfile; onUpdated: () => void }) {
  const [bio, setBio] = useState(profile.bio ?? '');
  const [websites, setWebsites] = useState<string[]>(
    profile.websites.length > 0 ? profile.websites : [''],
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function report(err: unknown, fallback: string) {
    setError(err instanceof ApiError || err instanceof Error ? err.message : fallback);
  }

  async function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 다시 선택해도 onChange가 또 발생하도록
    if (!file) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await fileToAvatarPayload(file);
      await api.put('/users/me/avatar', payload);
      setNotice('프로필 이미지가 변경됐습니다.');
      onUpdated();
    } catch (err) {
      report(err, '이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  }

  async function onRemoveImage() {
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      await api.delete('/users/me/avatar');
      setNotice('기본 이미지로 되돌렸습니다.');
      onUpdated();
    } catch (err) {
      report(err, '이미지 삭제에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  }

  async function onPickBanner(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await fileToBannerPayload(file);
      await api.put('/users/me/banner', payload);
      setNotice('배너가 변경됐습니다.');
      onUpdated();
    } catch (err) {
      report(err, '배너 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  }

  async function onRemoveBanner() {
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      await api.delete('/users/me/banner');
      setNotice('배너를 제거했습니다.');
      onUpdated();
    } catch (err) {
      report(err, '배너 삭제에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api.patch('/users/me/profile', {
        bio,
        websites: websites.map((w) => w.trim()).filter((w) => w !== ''),
      });
      setNotice('프로필이 저장됐습니다.');
      onUpdated();
    } catch (err) {
      report(err, '프로필 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded border border-ink-500 p-3 text-xs">
      <p className="font-bold text-fg">프로필 설정</p>

      <div className="mt-2 flex items-center gap-3">
        <Avatar username={profile.username} avatarVersion={profile.avatarVersion} size={48} />
        <label className="cursor-pointer rounded border border-ink-500 px-2 py-1 text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]">
          {uploading ? '처리 중...' : '이미지 업로드'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onPickImage}
            disabled={uploading}
            className="hidden"
          />
        </label>
        {profile.avatarVersion != null && (
          <button
            type="button"
            onClick={onRemoveImage}
            disabled={uploading}
            className="text-fg-muted underline hover:text-[var(--color-wa)] disabled:opacity-60"
          >
            기본 이미지로
          </button>
        )}
        <span className="mx-1 text-ink-500">|</span>
        <label className="cursor-pointer rounded border border-ink-500 px-2 py-1 text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]">
          {uploading ? '처리 중...' : '배너 업로드'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onPickBanner}
            disabled={uploading}
            className="hidden"
          />
        </label>
        {profile.bannerVersion != null && (
          <button
            type="button"
            onClick={onRemoveBanner}
            disabled={uploading}
            className="text-fg-muted underline hover:text-[var(--color-wa)] disabled:opacity-60"
          >
            배너 제거
          </button>
        )}
      </div>

      <form onSubmit={onSave} className="mt-3 space-y-2">
        <div>
          <label className="text-fg-muted">
            소개
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="자기소개를 적어보세요 (300자 이내)"
              className="mt-1 w-full resize-none rounded border border-ink-500 bg-white px-2 py-1.5 text-fg outline-none focus:border-[var(--color-brand)]"
            />
          </label>
        </div>
        <div>
          <span className="text-fg-muted">사이트 (최대 5개)</span>
          <div className="mt-1 space-y-1.5">
            {websites.map((site, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={site}
                  onChange={(e) =>
                    setWebsites((prev) => prev.map((w, j) => (j === i ? e.target.value : w)))
                  }
                  maxLength={200}
                  placeholder="https://example.com"
                  className="w-full rounded border border-ink-500 bg-white px-2 py-1.5 text-fg outline-none focus:border-[var(--color-brand)]"
                />
                <button
                  type="button"
                  onClick={() => setWebsites((prev) => prev.filter((_, j) => j !== i))}
                  className="shrink-0 text-fg-muted hover:text-[var(--color-wa)]"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
          {websites.length < 5 && (
            <button
              type="button"
              onClick={() => setWebsites((prev) => [...prev, ''])}
              className="mt-1.5 rounded border border-ink-500 px-2 py-1 text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              + 사이트 추가
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-[var(--color-brand)] px-3 py-1.5 font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </form>

      {notice && <p className="mt-1 text-[var(--color-ac)]">{notice}</p>}
      {error && <p className="mt-1 text-[var(--color-wa)]">{error}</p>}
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
