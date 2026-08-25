import { PatchNotes } from '../../components/PatchNotes';

// 분과 소개는 아직 내용이 없어 club-homepage/index.html의 자리표시자 문구를 그대로 옮겼다.
const DEPARTMENTS = [
  { name: '알고리즘', desc: '--알고리즘 분과 설명--' },
  { name: '인공지능', desc: '--인공지능 분과 설명--' },
  { name: '정보보안', desc: '--정보보안 분과 설명--' },
  { name: '임베디드', desc: '--임베디드 분과 설명--' },
];

/** 동아리 홈페이지 메인(club-homepage/index.html)의 React 버전. */
export function ClubHomePage() {
  return (
    <div className="relative">
      <section className="border-b border-ink-600 pb-12">
        <h1 className="max-w-xl text-4xl font-black leading-tight text-fg">
          알고리즘과 함께 성장하는
          <br />
          동아리, <span className="text-[var(--color-brand)]">두루누리</span>
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-fg-muted">
          함께 문제를 풀고, 서로 배우고, 직접 서비스를 만드는 동아리입니다.
        </p>
        <div className="mt-8 flex gap-3">
          <a
            href="#join"
            className="rounded bg-[var(--color-brand)] px-5 py-2.5 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)]"
          >
            가입하러 가기
          </a>
          <a
            href="#about"
            className="rounded border border-ink-500 px-5 py-2.5 text-sm font-bold text-fg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
          >
            더 알아보기
          </a>
        </div>
      </section>

      <section className="border-b border-ink-600 py-12">
        <h2 className="text-lg font-bold text-fg">분과</h2>
        <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {DEPARTMENTS.map((d) => (
            <div
              key={d.name}
              className="rounded border border-ink-600 bg-[var(--color-surface)] p-5 hover:border-[var(--color-brand)]"
            >
              <h3 className="text-base font-bold text-fg">{d.name}</h3>
              <p className="mt-1.5 text-sm text-fg-muted">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* OJ 홈페이지와 동일한 "최근 업데이트" 위젯을 그대로 재사용한다(오늘 밤 내내 손으로
          맞추려던 게 이거 하나로 해결된다 — 결국 이걸 위해 이 마이그레이션을 시작했다). */}
      <div className="hidden xl:block fixed right-4 2xl:right-6 bottom-6 z-20">
        <PatchNotes />
      </div>
    </div>
  );
}
