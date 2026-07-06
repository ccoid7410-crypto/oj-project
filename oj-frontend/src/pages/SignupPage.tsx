import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export function SignupPage() {
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await signup(email, username, password, studentId);
      setSentMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '회원가입에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sentMessage) {
    return (
      <div className="mx-auto max-w-sm rounded border border-ink-500 bg-white p-6 text-sm">
        <h1 className="text-2xl font-bold">메일함을 확인해주세요</h1>
        <p className="mt-4 text-fg-muted">{sentMessage}</p>
        <p className="mt-4 text-xs text-fg-muted">
          메일이 안 왔나요?{' '}
          <Link to="/resend-verification" className="text-[var(--color-brand)] hover:underline">
            다시 보내기
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm rounded border border-ink-500 bg-white p-6">
      <h1 className="text-2xl font-bold">회원가입</h1>
      <p className="mt-1 text-xs text-fg-muted">학교 이메일(@cbsh.hs.kr)로만 가입할 수 있어요.</p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          이메일
          <input
            type="email"
            required
            placeholder="student@cbsh.hs.kr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          username (영문/숫자/_, 3~20자)
          <input
            required
            pattern="^[a-zA-Z0-9_]{3,20}$"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          학번 (선택, 동아리 회원인 경우)
          <input
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="예: 20240001"
            className="rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          비밀번호 (8자 이상)
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
          />
        </label>
        {error && <p className="text-xs text-[var(--color-wa)]">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded bg-[var(--color-brand)] py-2 font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {submitting ? '가입 중...' : '회원가입'}
        </button>
      </form>
      <p className="mt-4 text-xs text-fg-muted">
        이미 계정이 있나요?{' '}
        <Link to="/login" className="text-[var(--color-brand)] hover:underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
