import { Link } from 'react-router-dom';

export interface MegaMenuItem {
  to: string;
  label: string;
}

export interface MegaMenu {
  key: string;
  label: string;
  /** 1개면 트리거 자체가 그 링크로 동작하는 평범한 메뉴, 2개 이상이면 드롭다운이 열린다. */
  items: MegaMenuItem[];
}

/**
 * 상단바 메뉴 트리거. 하위 항목이 1개뿐이면 그냥 링크, 2개 이상이면 hover 시
 * 상위 탭 버튼 바로 아래로 세로 드롭다운을 연다.
 */
export function MegaMenuTrigger({
  menu,
  className,
  isOpen,
  onOpen,
  onClose,
  onCancelClose,
  onScheduleClose,
}: {
  menu: MegaMenu;
  className?: string;
  isOpen: boolean;
  onOpen: (key: string) => void;
  onClose: () => void;
  onCancelClose: () => void;
  onScheduleClose: () => void;
}) {
  if (menu.items.length <= 1) {
    return (
      <Link to={menu.items[0]?.to ?? '#'} className={className}>
        {menu.label}
      </Link>
    );
  }
  return (
    <div
      className="relative flex items-center self-stretch"
      onMouseEnter={() => {
        onCancelClose();
        onOpen(menu.key);
      }}
      onMouseLeave={onScheduleClose}
    >
      <Link to={menu.items[0].to} className={className}>
        {menu.label}
        <span className="ml-1 inline-block text-[9px] align-[1px]">▾</span>
      </Link>
      {/* 헤더 하단에서 클리핑하는 뷰포트. 안쪽 패널이 헤더 뒤에 숨어 있다가(위로
          밀려 클리핑됨) 호버 시 헤더 아래로 슬라이드되어 내려온다. */}
      <div className="pointer-events-none absolute -left-3 top-full z-30 overflow-hidden pb-3">
        <div
          className={`min-w-[150px] rounded-b-md border border-t-0 border-[var(--color-header-line)] bg-[var(--color-surface)] py-1 transition-transform duration-200 ease-out ${
            isOpen
              ? 'pointer-events-auto translate-y-0 shadow-[0_8px_16px_rgba(0,0,0,0.15)]'
              : '-translate-y-full'
          }`}
        >
          {menu.items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="block whitespace-nowrap px-3 py-1.5 text-[13px] text-fg hover:bg-[var(--color-header-line)] hover:text-[var(--color-brand)]"
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
