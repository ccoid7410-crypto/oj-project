import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 로그인 후 돌아갈 위치 (?redirect=...). 외부 사이트로 튕기는 open redirect를 막기 위해
  // 사이트 내부 경로(/로 시작)만 허용하고, //(프로토콜 생략 주소)와 로그인/가입 페이지는 제외한다.
  const rawRedirect = searchParams.get('redirect');
  const redirect =
    rawRedirect &&
    rawRedirect.startsWith('/') &&
    !rawRedirect.startsWith('//') &&
    !rawRedirect.startsWith('/login') &&
    !rawRedirect.startsWith('/signup')
      ? rawRedirect
      : null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      if (redirect) {
        if (redirect.startsWith('/home')) {
          // 동아리 홈페이지는 React 앱 밖의 정적 사이트라 전체 페이지 이동이 필요하다
          window.location.assign(redirect);
        } else {
          navigate(redirect, { replace: true });
        }
      } else {
        navigate('/problems');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '로그인에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded border border-ink-500 bg-white p-6">
      <h1 className="text-2xl font-bold">로그인</h1>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          이메일 또는 사용자명
          <input
            type="text"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          비밀번호
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-ink-500 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
          />
        </label>
        {error && (
          <p className="text-xs text-[var(--color-wa)]">
            {error}
            {error.includes('이메일 인증') && (
              <>
                {' '}
                <Link to="/resend-verification" className="text-[var(--color-brand)] hover:underline">
                  인증 메일 다시 받기
                </Link>
              </>
            )}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded bg-[var(--color-brand)] py-2 font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
        >
          {submitting ? '로그인 중...' : '로그인'}
        </button>
      </form>
      <p className="mt-4 text-xs text-fg-muted">
        계정이 없나요?{' '}
        <Link to="/signup" className="text-[var(--color-brand)] hover:underline">
          회원가입
        </Link>
      </p>
    </div>
  );
}
