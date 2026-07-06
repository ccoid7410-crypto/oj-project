import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'done' | 'error'>('verifying');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('인증 토큰이 없습니다.');
      return;
    }
    verifyEmail(token)
      .then(() => {
        setStatus('done');
        setTimeout(() => navigate('/problems'), 1500);
      })
      .catch((err) => {
        setStatus('error');
        setError(err instanceof ApiError ? err.message : '인증에 실패했습니다.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="mx-auto max-w-sm rounded border border-ink-500 bg-white p-6 text-center text-sm">
      {status === 'verifying' && <p className="text-fg-muted">이메일 인증 중...</p>}
      {status === 'done' && <p className="font-bold text-[var(--color-ac)]">인증 완료! 잠시 후 이동합니다.</p>}
      {status === 'error' && (
        <>
          <p className="font-bold text-[var(--color-wa)]">{error}</p>
          <p className="mt-4 text-xs text-fg-muted">
            <Link to="/resend-verification" className="text-[var(--color-brand)] hover:underline">
              인증 메일 다시 받기
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
