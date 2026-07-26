# 디자인 가이드 (백준 스타일)

이 문서는 `oj-frontend`의 현재 디자인 시스템을 정리한 참조 문서다. 새로 화면을 만들거나
기존 화면을 다듬을 때 여기 있는 토큰/패턴을 그대로 재사용해야 한다 — 새 색상/컴포넌트를
바로 만들지 말고, 여기 없는 게 필요하면 먼저 이 문서에 추가하고 시작할 것.

**지향점**: 백준(acmicpc.net) 특유의 짙은 네이비 상단바 + 옅은 회색 배경 위 흰 콘텐츠 박스 +
조밀한 표 레이아웃. 그림자/그라데이션 없는 flat 디자인이되, 드롭다운 메뉴처럼 정말
"떠 있는" UI만 예외적으로 아주 옅은 그림자를 허용한다.

## 1. 색상 토큰

전부 `src/index.css`의 `@theme` 블록에 정의돼 있다. **하드코딩된 hex 값을 컴포넌트에
직접 쓰지 말고 항상 이 토큰을 참조할 것** (라이트/다크 테마 전환이 변수 값 교체만으로
동작하기 때문).

```css
--color-ink-900 ~ 500   /* 밝음→어두움 순. 900=배경, 500=진한 테두리 */
--color-surface          /* 콘텐츠 박스 배경(라이트=흰색, 다크=#161a20) - main, 카드 등 */
--color-fg              /* 기본 글자색 */
--color-fg-muted        /* 보조/설명 글자색 */
--color-brand           /* 포인트 블루 (#2f6fed) - 링크, 강조, 버튼 */
--color-brand-dim       /* brand의 hover용 진한 톤 */

--color-ac              /* 정답(맞았습니다) - 초록 */
--color-wa               /* 오답/에러 - 빨강 */
--color-tle              /* 시간/메모리 초과 - 주황 */
--color-ce               /* 컴파일 에러 - 보라 */
--color-pending          /* 채점 대기/중 - 파랑(brand와 동일) */

--color-header-bg        /* 상단바 배경 - 라이트=흰색, 다크=#161a20. 더 이상 고정 네이비가 아니다 */
--color-header-fg        /* 상단바 기본 글자색 (회청색) */
--color-header-fg-hover  /* 상단바 hover 글자색 (진한 글자색) */
--color-header-line      /* 상단바 하단 구분선(border-b) - 라이트=옅은 회색, 다크=#2e3743 */
--color-page-bg          /* 본문 배경(옅은 회색, 라이트 #f4f6f9 / 다크 #0e1116) */

--color-bronze / silver / gold / platinum / diamond / ruby
                         /* solved.ac 관례를 따르는 난이도 티어 색 */
```

Tailwind 유틸리티로 노출되는 것: `bg-ink-700`, `border-ink-500`, `text-fg-muted` 등.
브랜드/판정 색처럼 유틸리티가 없는 것은 `text-[var(--color-brand)]` 형태의 임의값으로 쓴다.

### 다크 테마
`:root.dark`에서 위 변수 전부를 재정의한다(`src/index.css` 하단). **헤더 색(`--color-header-*`)도
이제 다크 모드에서 바뀐다** — 라이트는 흰 바탕에 옅은 구분선, 다크는 `#161a20` 바탕에 `#2e3743`
구분선으로, 페이지 본문 톤과 자연스럽게 이어지는 쪽으로 바꿨다(예전엔 상단바만 항상 짙은
네이비로 고정돼 있었다). 새 컴포넌트를 만들 때 라이트/다크 모두에서 자연스러운지 직접 두 모드로
확인할 것(헤더 우측의 `HeaderThemeToggle` 버튼으로 전환 가능).

## 2. 타이포그래피

- 본문 기본 폰트 크기: **13px** (`body`에 지정, `src/index.css`)
- 폰트: `"Noto Sans KR", "Inter", sans-serif` (`--font-body`)
- 표/목록처럼 조밀해야 하는 곳은 `text-[13px]` 또는 `text-xs`를 명시적으로 쓴다.
- 강조 숫자/제목은 `font-bold` 또는 `font-black`, 본문은 `font-medium`/기본.

## 3. 레이아웃 구조

```
<div className="min-h-screen bg-[var(--color-page-bg)]">
  <header className="relative bg-[var(--color-header-bg)] border-b border-[var(--color-header-line)]">
    로고 + 인라인 메뉴(왼쪽) + 테마 토글 + 로그인/유저 정보(오른쪽, ml-auto)
    ← 메가 메뉴가 열리면 헤더 기준 절대좌표로 패널이 바로 아래에 펼쳐진다(§4)
  </header>
  <main className="mx-auto max-w-5xl border-x border-ink-600 bg-[var(--color-surface)] px-6 py-6">
    ← 회색 배경 위에 콘텐츠 박스로 얹힌 콘텐츠(`--color-surface`). 좌우 테두리로 배경과 분리.
  </main>
</div>
```

- 컨테이너 폭은 `max-w-5xl`로 통일(약 1024px). 새 페이지도 이 폭을 벗어나지 않는다.
- 상단바는 그림자 없이 단색 배경(`--color-header-bg`) + 하단 구분선(`--color-header-line`)만
  쓴다. 메뉴 링크는 밑줄 대신 **hover 시 글자색만 밝아짐**
  (`text-[var(--color-header-fg)] hover:text-[var(--color-header-fg-hover)]`).
- 페이지 제목은 `<h1 className="text-2xl font-bold">` 정도, 그 아래 `text-xs text-fg-muted`로
  한 줄 설명을 붙이는 패턴이 반복된다(`MySubmissionsPage`, `ProblemListPage` 등 참고).

## 4. 상단바 메가 메뉴 (`MegaMenuTrigger` / `MegaMenuPanel`)

`src/components/HeaderDropdown.tsx`. 예전엔 트리거마다 좁은 세로 드롭다운이었는데, 지금은
**바 전체 폭을 덮는 메가 패널** 패턴으로 바뀌었다 — 백준의 "문제" 메뉴처럼 커서를 올리면
헤더 바로 아래에 좌측 라벨 칼럼 + 우측 4열 하위 항목 그리드가 펼쳐진다.

여닫는 상태는 `HeaderDropdown`이 아니라 **`Layout.tsx`가 소유**한다(패널이 헤더 전체 폭이라
`<header onMouseLeave>`에서 닫아야 하기 때문):

```tsx
// Layout.tsx
const [openMenu, setOpenMenu] = useState<string | null>(null);
const megaMenus: MegaMenu[] = [
  { key: 'problems', label: '문제', items: [{ to: '/problems', label: '전체 문제' }, ...] },
  ...
];
const openMenuData = megaMenus.find((m) => m.key === openMenu) ?? null;

<header onMouseLeave={scheduleClose}>
  {megaMenus.map((menu) => (
    <MegaMenuTrigger key={menu.key} menu={menu} className={navLinkClass} onOpen={setOpenMenu} />
  ))}
  {openMenuData && (
    <MegaMenuPanel menu={openMenuData} onClose={() => setOpenMenu(null)}
      onMouseEnter={cancelClose} onMouseLeave={scheduleClose} />
  )}
</header>
```

- **하위 항목이 1개인 메뉴는 트리거 자체가 그 링크**(드롭다운 없이 바로 이동) —
  `MegaMenuTrigger`가 `items.length <= 1`이면 화살표 없는 평범한 `<Link>`로 렌더링한다.
  2개 이상일 때만 `▾` 화살표가 붙고 hover 시 패널이 열린다.
- 트리거→패널로 마우스가 넘어갈 때 깜빡이며 닫히지 않도록 **120ms 닫힘 유예 타이머**를
  쓴다(`Layout.tsx`의 `CLOSE_DELAY_MS`). 새 메가메뉴를 추가해도 이 타이머 로직은 그대로
  재사용하면 된다.
- 패널은 `border-b border-[var(--color-header-line)] bg-[var(--color-header-bg)]` +
  **아주 옅은 그림자**(`shadow-[0_2px_6px_rgba(0,0,0,0.12)]`) 하나만 예외적으로 허용된다.
  이 문서의 다른 모든 컴포넌트는 그림자를 쓰지 않는다.
- 실제 존재하지 않는 기능(그룹 브라우징, 게시판 3분류, 도움말 등)을 흉내 낸 가짜 하위 항목을
  만들지 말 것 — 메뉴 항목은 항상 실제로 동작하는 라우트여야 한다.

## 5. 배지/칩 컴포넌트

| 컴포넌트 | 용도 | 형태 |
|---|---|---|
| `DifficultyBadge` | 난이도 티어(브론즈~루비) | `h-4 w-6 rounded-[3px]`, 티어 색 배경 + 흰 글자, solved.ac 확장 느낌의 정사각 칩 |
| `VerdictBadge` | 채점 결과(맞았습니다/틀렸습니다 등) | 텍스트 색상만(배경 없음), 진행 중(PENDING/JUDGING)이면 `pulse-dot` 애니메이션 점. `showPulse={false}`를 주면 점 없이 정적 텍스트만(목록 화면용) |
| `ProblemTypeBadge` | 문제 유형(정확도/인터랙티브) + 연습 여부 | `rounded border` 아웃라인 칩, STANDARD면 아무것도 안 그림(기본값은 조용히 생략) |

새 배지가 필요하면 이 셋 중 형태가 제일 비슷한 걸 복제해서 시작할 것 — 배경색 꽉 채운 배지는
`DifficultyBadge` 계열, 아웃라인 배지는 `ProblemTypeBadge` 계열로 통일한다.

## 6. 표(테이블) 패턴

`ProblemListPage`, `MySubmissionsPage`, `SubmissionFeedPage`가 기준 예시다.

```tsx
<table className="w-full border-collapse text-left text-[13px]">
  <thead>
    <tr className="bg-ink-700 text-fg-muted">
      <th className="border border-ink-600 px-2 py-1.5 font-medium">...</th>
    </tr>
  </thead>
  <tbody>
    <tr className="hover:bg-ink-700/60">
      <td className="border border-ink-600 px-2 py-1.5">...</td>
    </tr>
  </tbody>
</table>
```

- 헤더 행: `bg-ink-700` + `text-fg-muted` + `font-medium`.
- 모든 셀에 `border border-ink-600` (셀 단위 테두리, 백준 표 느낌).
- 행 hover는 `hover:bg-ink-700/60`(반투명)만 — 다른 강조 효과 없음.
- 중앙 정렬이 필요한 숫자 컬럼(맞힌 사람/제출/점수 등)은 `text-center` 명시.

## 7. 버튼

```tsx
// 주 버튼(브랜드 채움)
className="rounded bg-[var(--color-brand)] px-5 py-2.5 font-bold text-white hover:bg-[var(--color-brand-dim)]"

// 보조 버튼(아웃라인)
className="rounded border border-ink-500 px-5 py-2.5 font-bold text-fg hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
```

- 모서리는 항상 기본 `rounded`(4px). `rounded-lg/xl` 등 큰 반경은 쓰지 않는다(아바타/배지 등
  원형이 필요한 곳만 `rounded-full` 예외).
- 그림자 없음. hover는 배경색 또는 글자색 변화만.

## 8. 하지 말 것

- `shadow-md/lg/xl` 등 임의의 그림자 유틸리티 추가 금지 (드롭다운 패널 하나만 예외, §4 참고).
- 그라데이션(`bg-gradient-*`) 금지.
- `rounded-xl`/`rounded-2xl`처럼 큰 모서리 반경 금지.
- 색상 hex 값을 컴포넌트에 직접 쓰지 말 것 — 반드시 `--color-*` 토큰 경유.
- 새 컨테이너 폭(`max-w-*`)을 페이지마다 다르게 잡지 말 것 — `max-w-5xl` 통일.

## 9. 작업 시 확인 체크리스트

1. 라이트/다크 테마 둘 다 확인했는가(`ThemeButtons`로 전환).
2. 표/목록이면 위 §6 패턴을 그대로 썼는가.
3. 새 배지/칩이 §5의 두 형태(채움형/아웃라인형) 중 하나에 해당하는가.
4. 그림자/그라데이션을 안 썼는가(드롭다운 제외).
5. 상단바에 새 메뉴를 추가했다면 하위 메뉴가 필요한지 확인하고, 필요하면 `HeaderDropdown` 재사용.
