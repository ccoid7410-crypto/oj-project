import { Link } from 'react-router-dom';

export interface MegaMenuItem {
  to: string;
  label: string;
}

export interface MegaMenu {
  key: string;
  label: string;
  /** 1개면 트리거 자체가 그 링크로 동작하는 평범한 메뉴, 2개 이상이면 메가패널이 열린다. */
  items: MegaMenuItem[];
}

/**
 * 상단바 메뉴 트리거. 하위 항목이 1개뿐이면 그냥 링크, 2개 이상이면 hover 시
 * `MegaMenuPanel`을 여는 트리거로 동작한다(패널 자체는 헤더 레벨에서 한 번만 렌더링됨 -
 * `Layout.tsx` 참고. 항목이 적은 메뉴마다 패널을 새로 만들면 열림 상태 경합이 생긴다).
 */
export function MegaMenuTrigger({
  menu,
  className,
  onOpen,
}: {
  menu: MegaMenu;
  className?: string;
  onOpen: (key: string) => void;
}) {
  if (menu.items.length <= 1) {
    return (
      <Link to={menu.items[0]?.to ?? '#'} className={className}>
        {menu.label}
      </Link>
    );
  }
  return (
    <Link to={menu.items[0].to} className={className} onMouseEnter={() => onOpen(menu.key)}>
      {menu.label}
      <span className="ml-1 inline-block text-[9px] align-[1px]">▾</span>
    </Link>
  );
}

/**
 * 백준의 "문제" 메뉴처럼 상단바 전체 폭으로 펼쳐지는 메가 패널.
 * 왼쪽에 메뉴 이름, 오른쪽에 하위 항목을 그리드로 배치한다.
 */
export function MegaMenuPanel({
  menu,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: {
  menu: MegaMenu;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <div
      className="absolute inset-x-0 top-full z-20 border-b border-[var(--color-header-line)] bg-[var(--color-surface)] shadow-[0_2px_6px_rgba(0,0,0,0.12)]"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="mx-auto grid max-w-5xl grid-cols-[120px_1fr] gap-4 px-6 py-4">
        <div className="text-xs font-bold text-fg-muted">{menu.label}</div>
        <div className="grid grid-cols-4 gap-x-4 gap-y-2 border-l border-ink-600 pl-4">
          {menu.items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-[13px] text-fg hover:text-[var(--color-brand)]"
              onClick={onClose}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
