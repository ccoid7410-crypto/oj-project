import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Language, StudentIdWindow, UserProfile } from '../api/types';
import { LANGUAGE_OPTIONS } from '../lib/languages';
import { Avatar } from '../components/Avatar';
import { ThemeButtons } from '../components/ThemeButtons';
import { fileToAvatarPayload, fileToBannerPayload } from '../lib/avatar';
import { useAuth } from '../context/AuthContext';

type Tab = 'profile' | 'security' | 'theme' | 'oj';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'profile', label: '프로필' },
  { key: 'security', label: '개인정보 및 보안' },
  { key: 'theme', label: '테마' },
  { key: 'oj', label: 'Durunuri OJ' },
];

export function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');

  if (!user) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">설정</h1>

      <div className="mt-4 flex gap-1 border-b border-ink-500">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key
                ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                : 'border-transparent text-fg-muted hover:text-fg'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'profile' && <ProfileTab />}
        {tab === 'security' && <SecurityTab />}
        {tab === 'theme' && <ThemeTab />}
        {tab === 'oj' && <OjTab />}
      </div>
    </div>
  );
}

// ===== 공통 =====

const cardClass = 'rounded border border-ink-500 p-4 text-sm';
const inputClass =
  'w-full rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]';
const primaryBtn =
  'rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60';

function report(err: unknown, fallback: string) {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

// ===== 1) 프로필 탭 =====

function ProfileTab() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bio, setBio] = useState('');
  const [websites, setWebsites] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function loadProfile() {
    if (!user) return;
    api.get<UserProfile>(`/users/${user.username}`).then((p) => {
      setProfile(p);
      setBio(p.bio ?? '');
      setWebsites(p.websites.length > 0 ? p.websites : ['']);
    });
  }
  useEffect(loadProfile, [user?.username]);

  if (!user || !profile) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  async function withUpload(fn: () => Promise<void>, ok: string, fail: string) {
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(ok);
      loadProfile();
    } catch (err) {
      setError(report(err, fail));
    } finally {
      setUploading(false);
    }
  }

  async function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await withUpload(
      async () => api.put('/users/me/avatar', await fileToAvatarPayload(file)).then(() => undefined),
      '프로필 이미지가 변경됐습니다.',
      '이미지 업로드에 실패했습니다.',
    );
  }
  async function onPickBanner(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await withUpload(
      async () => api.put('/users/me/banner', await fileToBannerPayload(file)).then(() => undefined),
      '배너가 변경됐습니다.',
      '배너 업로드에 실패했습니다.',
    );
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
      loadProfile();
    } catch (err) {
      setError(report(err, '프로필 저장에 실패했습니다.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cardClass}>
      {/* 사용자명: 표시만 하고 바꿀 수 없다(비활성). */}
      <label className="flex flex-col gap-1">
        <span className="text-fg-muted">사용자명 (변경 불가)</span>
        <input value={profile.username} disabled className={`${inputClass} opacity-50`} />
      </label>

      <div className="mt-4 flex items-center gap-3">
        <Avatar username={profile.username} avatarVersion={profile.avatarVersion} size={48} />
        <label className="cursor-pointer rounded border border-ink-500 px-2 py-1 text-xs text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]">
          {uploading ? '처리 중...' : '프로필 사진'}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPickImage} disabled={uploading} className="hidden" />
        </label>
        {profile.avatarVersion != null && (
          <button
            type="button"
            onClick={() => withUpload(() => api.delete('/users/me/avatar').then(() => undefined), '기본 이미지로 되돌렸습니다.', '이미지 삭제에 실패했습니다.')}
            disabled={uploading}
            className="text-xs text-fg-muted underline hover:text-[var(--color-wa)] disabled:opacity-60"
          >
            기본 이미지로
          </button>
        )}
        <span className="mx-1 text-ink-500">|</span>
        <label className="cursor-pointer rounded border border-ink-500 px-2 py-1 text-xs text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]">
          {uploading ? '처리 중...' : '배너'}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPickBanner} disabled={uploading} className="hidden" />
        </label>
        {profile.bannerVersion != null && (
          <button
            type="button"
            onClick={() => withUpload(() => api.delete('/users/me/banner').then(() => undefined), '배너를 제거했습니다.', '배너 삭제에 실패했습니다.')}
            disabled={uploading}
            className="text-xs text-fg-muted underline hover:text-[var(--color-wa)] disabled:opacity-60"
          >
            배너 제거
          </button>
        )}
      </div>

      <form onSubmit={onSave} className="mt-4 space-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-fg-muted">소개</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="자기소개를 적어보세요 (300자 이내)"
            className={`${inputClass} resize-none`}
          />
        </label>
        <div>
          <span className="text-fg-muted">링크 (최대 5개)</span>
          <div className="mt-1 space-y-1.5">
            {websites.map((site, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={site}
                  onChange={(e) => setWebsites((prev) => prev.map((w, j) => (j === i ? e.target.value : w)))}
                  maxLength={200}
                  placeholder="https://example.com"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setWebsites((prev) => prev.filter((_, j) => j !== i))}
                  className="shrink-0 text-xs text-fg-muted hover:text-[var(--color-wa)]"
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
              className="mt-1.5 rounded border border-ink-500 px-2 py-1 text-xs text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
            >
              + 링크 추가
            </button>
          )}
        </div>
        <button type="submit" disabled={saving} className={primaryBtn}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </form>

      {notice && <p className="mt-2 text-[var(--color-ac)]">{notice}</p>}
      {error && <p className="mt-2 text-[var(--color-wa)]">{error}</p>}
    </div>
  );
}

// ===== 2) 개인정보 및 보안 탭 =====

function SecurityTab() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="flex flex-col gap-4">
      <NameCard />
      <StudentIdCard />
      <PasswordCard />
      {user.role !== 'ADMIN' && <DeleteAccountCard />}
    </div>
  );
}

function NameCard() {
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
      setError(report(err, '이름 저장에 실패했습니다.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cardClass}>
      <p className="font-bold">이름 (실명)</p>
      {!user?.name && <p className="mt-1 text-xs text-fg-muted">아직 등록된 이름이 없습니다.</p>}
      <form onSubmit={onSubmit} className="mt-2 flex items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="예: 김철수" className="w-48 rounded border border-ink-500 bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-brand)]" />
        <button type="submit" disabled={submitting || !name.trim()} className="rounded bg-[var(--color-brand)] px-3 py-1.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60">
          {submitting ? '저장 중...' : '저장'}
        </button>
      </form>
      {notice && <p className="mt-2 text-xs text-[var(--color-ac)]">{notice}</p>}
      {error && <p className="mt-2 text-xs text-[var(--color-wa)]">{error}</p>}
    </div>
  );
}

function StudentIdCard() {
  const { user, refreshUser } = useAuth();
  const [win, setWin] = useState<StudentIdWindow | null>(null);
  const [studentId, setStudentId] = useState(user?.studentId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api.get<StudentIdWindow>('/users/me/student-id-window').then(setWin);
  }, []);

  const hasStudentId = !!user?.studentId;
  // 사용자명처럼, 최초 등록 전이거나 수정 기간일 때만 입력칸을 열고 그 외에는 비활성으로 둔다.
  const canEdit = !hasStudentId || (win?.isOpen ?? false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await api.patch('/users/me/student-id', { studentId });
      setNotice('학번이 저장됐습니다.');
      await refreshUser();
    } catch (err) {
      setError(report(err, '학번 저장에 실패했습니다.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cardClass}>
      <p className="font-bold">입학년도+학번</p>
      {!hasStudentId && (
        <p className="mt-1 text-xs text-fg-muted">
          아직 등록된 학번이 없습니다. 최초 등록은 언제든 가능합니다. (입학년도 4자리 + 학번 4자리)
        </p>
      )}
      {hasStudentId && !win?.isOpen && (
        <p className="mt-1 text-xs text-fg-muted">
          지금은 수정 기간이 아닙니다.
          {win?.startsAt && win?.endsAt && (
            <> (다음 수정 가능: {new Date(win.startsAt).toLocaleString('ko-KR')} ~ {new Date(win.endsAt).toLocaleString('ko-KR')})</>
          )}
        </p>
      )}
      {hasStudentId && win?.isOpen && <p className="mt-1 text-xs text-[var(--color-ac)]">지금은 학번 수정 기간입니다.</p>}

      <form onSubmit={onSubmit} className="mt-2 flex items-center gap-2">
        <input
          value={canEdit ? studentId : (user?.studentId ?? '')}
          onChange={(e) => setStudentId(e.target.value)}
          disabled={!canEdit}
          inputMode="numeric"
          pattern="^20\d{6}$"
          maxLength={8}
          placeholder="예: 20261119"
          className={`w-48 rounded border border-ink-500 bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-brand)] ${canEdit ? '' : 'opacity-50'}`}
        />
        {canEdit && (
          <button type="submit" disabled={submitting || !studentId} className="rounded bg-[var(--color-brand)] px-3 py-1.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60">
            {submitting ? '저장 중...' : '저장'}
          </button>
        )}
      </form>
      {notice && <p className="mt-2 text-xs text-[var(--color-ac)]">{notice}</p>}
      {error && <p className="mt-2 text-xs text-[var(--color-wa)]">{error}</p>}
    </div>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (next !== confirm) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/users/me/change-password', { currentPassword: current, newPassword: next });
      setNotice('비밀번호가 변경됐습니다.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(report(err, '비밀번호 변경에 실패했습니다.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cardClass}>
      <p className="font-bold">비밀번호 변경</p>
      <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-2">
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="현재 비밀번호" autoComplete="current-password" className={inputClass} />
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="새 비밀번호 (8자 이상)" minLength={8} autoComplete="new-password" className={inputClass} />
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="새 비밀번호 확인" autoComplete="new-password" className={inputClass} />
        <button type="submit" disabled={submitting || !current || !next || !confirm} className={`${primaryBtn} self-start`}>
          {submitting ? '변경 중...' : '비밀번호 변경'}
        </button>
      </form>
      {notice && <p className="mt-2 text-xs text-[var(--color-ac)]">{notice}</p>}
      {error && <p className="mt-2 text-xs text-[var(--color-wa)]">{error}</p>}
    </div>
  );
}

function DeleteAccountCard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!window.confirm('정말 탈퇴할까요?\n제출 기록·댓글 등 모든 활동이 함께 삭제되며 되돌릴 수 없습니다.')) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/users/me/delete-account', { password });
      logout();
      navigate('/');
    } catch (err) {
      setError(report(err, '탈퇴에 실패했습니다.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded border border-[var(--color-wa)]/40 p-4 text-sm">
      <p className="font-bold text-[var(--color-wa)]">회원 탈퇴</p>
      <p className="mt-1 text-xs text-fg-muted">
        계정과 모든 활동 기록(제출, 댓글 등)이 삭제되며 되돌릴 수 없습니다. 비밀번호를 입력해 확인해주세요.
      </p>
      <form onSubmit={onSubmit} className="mt-2 flex items-center gap-2">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" className="w-48 rounded border border-ink-500 bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-wa)]" />
        <button type="submit" disabled={submitting || !password} className="rounded bg-[var(--color-wa)] px-3 py-1.5 text-sm font-bold text-white hover:opacity-85 disabled:opacity-60">
          {submitting ? '처리 중...' : '탈퇴'}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-[var(--color-wa)]">{error}</p>}
    </div>
  );
}

// ===== 3) 테마 탭 =====

function ThemeTab() {
  return (
    <div className={cardClass}>
      <p className="font-bold">테마</p>
      <p className="mt-1 text-xs text-fg-muted">화면 색상 모드를 고릅니다. 시스템은 기기 설정을 따릅니다.</p>
      <div className="mt-3">
        <ThemeButtons />
      </div>
    </div>
  );
}

// ===== 4) Durunuri OJ 탭 (온라인 저지 관련 설정) =====

function OjTab() {
  return (
    <div className="flex flex-col gap-4">
      <PreferredLanguageCard />
    </div>
  );
}

function PreferredLanguageCard() {
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
      setError(report(err, '저장에 실패했습니다.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cardClass}>
      <p className="font-bold">기본 제출 언어</p>
      <p className="mt-1 text-xs text-fg-muted">문제 페이지에서 이 언어가 자동으로 선택됩니다.</p>
      <form onSubmit={onSubmit} className="mt-2 flex items-center gap-2">
        <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="w-48 rounded border border-ink-500 bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--color-brand)]">
          <option value="" disabled>언어 선택</option>
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button type="submit" disabled={submitting || !language} className="rounded bg-[var(--color-brand)] px-3 py-1.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60">
          {submitting ? '저장 중...' : '저장'}
        </button>
      </form>
      {notice && <p className="mt-2 text-xs text-[var(--color-ac)]">{notice}</p>}
      {error && <p className="mt-2 text-xs text-[var(--color-wa)]">{error}</p>}
    </div>
  );
}
