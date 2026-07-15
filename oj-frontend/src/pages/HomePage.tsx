import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useBrandName } from '../lib/useBrandName';

interface SiteBanner {
  enabled: boolean;
  imageUrl: string | null;
  linkUrl: string | null;
}

export function HomePage() {
  const { user } = useAuth();
  const brandName = useBrandName();
  const [banner, setBanner] = useState<SiteBanner | null>(null);

  // 관리자가 설정한 글로벌 배너. 부가 요소라 실패해도 조용히 숨긴다.
  useEffect(() => {
    api
      .get<SiteBanner>('/site-banner')
      .then(setBanner)
      .catch(() => {});
  }, []);

  const bannerImg = banner?.enabled && banner.imageUrl && (
    <img src={banner.imageUrl} alt="배너" className="block max-h-[220px] w-full object-cover" />
  );

  return (
    <div className="flex flex-col items-start">
      {bannerImg && (
        <div className="mb-8 w-full overflow-hidden rounded">
          {banner?.linkUrl ? (
            <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer">
              {bannerImg}
            </a>
          ) : (
            bannerImg
          )}
        </div>
      )}

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
