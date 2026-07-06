import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBrandName } from '../lib/useBrandName';

export function HomePage() {
  const { user } = useAuth();
  const brandName = useBrandName();

  return (
    <div className="flex flex-col items-start">
      <h1 className="max-w-xl text-4xl font-black leading-tight">
        <span className="text-[var(--color-brand)]">{brandName}</span>
        <br />
        코드를 제출하면, 저지가 채점합니다.
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-fg-muted">
        문제를 풀고 코드를 제출하면 격리된 샌드박스에서 테스트케이스를 하나씩 채점해요.
        결과는 실시간으로 확인할 수 있어요.
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          to="/problems"
          className="rounded bg-[var(--color-brand)] px-5 py-2.5 font-bold text-white hover:bg-[var(--color-brand-dim)]"
        >
          문제 풀러가기
        </Link>
        {!user && (
          <Link
            to="/signup"
            className="rounded border border-ink-500 px-5 py-2.5 font-bold text-fg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
          >
            회원가입
          </Link>
        )}
      </div>
    </div>
  );
}
