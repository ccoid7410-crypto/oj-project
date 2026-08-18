import { useMemo, useState } from 'react';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function makeCalendarDays(month: Date): CalendarDay[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const gridStart = new Date(year, monthIndex, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return { date, isCurrentMonth: date.getMonth() === monthIndex };
  });
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const days = useMemo(() => makeCalendarDays(visibleMonth), [visibleMonth]);

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-600 pb-4">
        <div>
          <h1 className="text-2xl font-bold">일정</h1>
          <p className="mt-1 text-sm text-fg-muted">수행평가 일정과 시험 범위를 한눈에 확인하세요.</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            aria-label="이전 달"
            className="h-8 rounded-l border border-ink-500 px-3 text-sm font-bold hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setVisibleMonth(startOfMonth(today))}
            className="h-8 border-y border-ink-500 px-3 text-xs font-bold hover:text-[var(--color-brand)]"
          >
            오늘
          </button>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            aria-label="다음 달"
            className="h-8 rounded-r border border-ink-500 px-3 text-sm font-bold hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black tabular-nums">
          {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
        </h2>
        <div className="flex items-center gap-4 text-xs text-fg-muted" aria-label="일정 종류">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[var(--color-brand)]" /> 수행평가
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[var(--color-tle)]" /> 시험
          </span>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[700px] overflow-hidden rounded border border-ink-500">
          <div className="grid grid-cols-7 bg-ink-700">
            {WEEKDAYS.map((weekday, index) => (
              <div
                key={weekday}
                className={`border-r border-ink-600 py-2 text-center text-xs font-bold last:border-r-0 ${
                  index === 0 ? 'text-[var(--color-wa)]' : index === 6 ? 'text-[var(--color-brand)]' : 'text-fg-muted'
                }`}
              >
                {weekday}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map(({ date, isCurrentMonth }, index) => {
              const isToday = isSameDay(date, today);
              const weekday = date.getDay();
              return (
                <div
                  key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                  className={`min-h-24 border-r border-t border-ink-600 p-2 last:border-r-0 ${
                    index % 7 === 6 ? 'border-r-0' : ''
                  } ${isCurrentMonth ? 'bg-white' : 'bg-ink-700/50'}`}
                >
                  <span
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums ${
                      isToday
                        ? 'bg-[var(--color-brand)] font-bold text-white'
                        : !isCurrentMonth
                          ? 'text-fg-muted/50'
                          : weekday === 0
                            ? 'text-[var(--color-wa)]'
                            : weekday === 6
                              ? 'text-[var(--color-brand)]'
                              : 'text-fg'
                    }`}
                  >
                    {date.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded border border-dashed border-ink-500 bg-ink-700/40 px-4 py-5 text-center">
        <p className="text-sm font-bold">등록된 일정이 없습니다.</p>
        <p className="mt-1 text-xs text-fg-muted">다음 단계에서 수행평가 일정과 시험 범위를 등록할 수 있게 연결할 예정입니다.</p>
      </div>
    </div>
  );
}
