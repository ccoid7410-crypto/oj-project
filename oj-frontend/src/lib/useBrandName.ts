import { useEffect, useState } from 'react';

const DEFAULT_NAME = 'Durunuri OJ';
const EASTER_EGG_NAME = 'POJ';

/**
 * Shift + E + P를 동시에 누르고 있는 동안에만 로고 표기가 "POJ"로 바뀐다.
 * 셋 중 아무 키나 떼면 즉시 원래 이름("Durunuri OJ")으로 돌아온다.
 */
export function useBrandName(): string {
  const [pressed, setPressed] = useState<Set<string>>(new Set());

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

  const isEasterEgg = pressed.has('shift') && pressed.has('e') && pressed.has('p');
  return isEasterEgg ? EASTER_EGG_NAME : DEFAULT_NAME;
}
