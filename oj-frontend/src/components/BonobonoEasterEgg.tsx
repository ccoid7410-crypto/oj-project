import { useState } from 'react';

function BonobonoImage({ src, className }: { src: string; className: string }) {
  const [error, setError] = useState(false);
  
  if (error) {
    return (
      <div className={`flex items-center justify-center rounded-full bg-blue-200/50 backdrop-blur-md border border-white/50 shadow-xl ${className}`}>
        <span className="text-6xl drop-shadow-md">🦦</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="bonobono"
      className={className}
      style={{ mixBlendMode: 'multiply' }}
      onError={() => setError(true)}
    />
  );
}

export function BonobonoEasterEgg({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden opacity-90">
      {/* 1. 좌측 하단 아주 크게 (사용자 드로잉 참고) */}
      <BonobonoImage
        src="/bonobono1.png"
        className="absolute -bottom-10 -left-10 w-96 h-96 object-contain"
      />
      {/* 2. 우측 상단 적당한 크기 */}
      <BonobonoImage
        src="/bonobono2.png"
        className="absolute top-[10%] right-[10%] w-56 h-56 object-contain"
      />
      {/* 3. 우측 하단 살짝 걸치게 */}
      <BonobonoImage
        src="/bonobono3.png"
        className="absolute -bottom-5 right-20 w-48 h-48 object-contain"
      />
      
      {/* --- 복사해서 추가로 배치한 이미지들 --- */}
      
      {/* 4. 좌측 상단 작게 */}
      <BonobonoImage
        src="/bonobono1.png"
        className="absolute top-[5%] left-[15%] w-32 h-32 object-contain -rotate-12"
      />
      {/* 5. 중앙 상단 쯤 */}
      <BonobonoImage
        src="/bonobono2.png"
        className="absolute top-[15%] left-[45%] w-40 h-40 object-contain rotate-6"
      />
      {/* 6. 우측 중간 */}
      <BonobonoImage
        src="/bonobono3.png"
        className="absolute top-[45%] -right-10 w-64 h-64 object-contain -rotate-6"
      />
      {/* 7. 좌측 중간 */}
      <BonobonoImage
        src="/bonobono2.png"
        className="absolute bottom-[35%] left-[5%] w-48 h-48 object-contain rotate-12"
      />
      {/* 8. 중앙 하단 */}
      <BonobonoImage
        src="/bonobono1.png"
        className="absolute bottom-[10%] left-[35%] w-56 h-56 object-contain -rotate-3"
      />
      {/* 9. 화면 정중앙 쯤 배경으로 크게 */}
      <BonobonoImage
        src="/bonobono3.png"
        className="absolute top-[35%] left-[30%] w-80 h-80 object-contain opacity-70 rotate-3"
      />
    </div>
  );
}
