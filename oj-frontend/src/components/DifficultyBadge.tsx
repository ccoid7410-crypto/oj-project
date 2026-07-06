import { colorOfLevel, labelOfLevel, shortLabelOfLevel } from '../lib/difficulty';

/** solved.ac 확장에서 보이는 것 같은 작은 정사각 티어 칩(예: G3 = 골드 III). */
export function DifficultyBadge({ level }: { level: number }) {
  return (
    <span
      className="inline-flex h-4 w-6 shrink-0 items-center justify-center rounded-[3px] text-[9px] font-bold leading-none text-white"
      style={{ backgroundColor: colorOfLevel(level) }}
      title={labelOfLevel(level)}
    >
      {shortLabelOfLevel(level)}
    </span>
  );
}
