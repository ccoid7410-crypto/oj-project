import { useEffect, useState } from 'react';

const DEFAULT_NAME = 'Durunuri OJ';
const EASTER_EGG_NAME = 'POJ';

/** 매년 2월 11일과 4월 1일에는 하루 종일 POJ를 표시한다. */
function isAlwaysPojDay(date: Date): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return (month === 2 && day === 11) || (month === 4 && day === 1);
}

/**
 * Shift + E + P를 동시에 누르고 있는 동안에만 로고 표기가 "POJ"로 바뀐다.
 * 셋 중 아무 키나 떼면 즉시 원래 이름("Durunuri OJ")으로 돌아온다.
 */
export function useBrandName(): string {
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const [alwaysPoj, setAlwaysPoj] = useState(() => isAlwaysPojDay(new Date()));

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key !== 'e' && key !== 'p' && key !== 'shift') return;
      setPressed((prev) => {
        const next = new Set(prev);
        next.add(e.shiftKey ? 'shift' : key);
        if (key === 'e' || key === 'p') next.add(key);
        return next;
      });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setPressed((prev) => {
        if (!prev.size) return prev;
        const next = new Set(prev);
        next.delete(key);
        if (key === 'shift') next.delete('shift');
        if (!e.shiftKey) next.delete('shift');
        return next;
      });
    };
    const onBlur = () => setPressed(new Set());

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // 자정에 페이지를 열어둔 상태에서도 날짜 전환이 반영되도록 주기적으로 확인한다.
  useEffect(() => {
    const refresh = () => setAlwaysPoj(isAlwaysPojDay(new Date()));
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const isEasterEgg = pressed.has('shift') && pressed.has('e') && pressed.has('p');
  return alwaysPoj || isEasterEgg ? EASTER_EGG_NAME : DEFAULT_NAME;
}
