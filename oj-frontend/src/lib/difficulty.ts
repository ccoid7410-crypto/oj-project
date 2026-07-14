import type { Difficulty } from '../api/types';

// 백엔드 src/common/difficulty.ts와 동일한 값. 레벨 1~30 = 브론즈V ~ 루비I.
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 30;

const TIERS: { difficulty: Difficulty; label: string; color: string }[] = [
  { difficulty: 'BRONZE', label: '브론즈', color: 'var(--color-bronze)' },
  { difficulty: 'SILVER', label: '실버', color: 'var(--color-silver)' },
  { difficulty: 'GOLD', label: '골드', color: 'var(--color-gold)' },
  { difficulty: 'PLATINUM', label: '플래티넘', color: 'var(--color-platinum)' },
  { difficulty: 'DIAMOND', label: '다이아몬드', color: 'var(--color-diamond)' },
  { difficulty: 'RUBY', label: '루비', color: 'var(--color-ruby)' },
];

const ROMAN = ['V', 'IV', 'III', 'II', 'I'];

export function clampLevel(level: number): number {
  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Math.round(level)));
}

export function tierIndexOfLevel(level: number): number {
  return Math.floor((clampLevel(level) - 1) / 5);
}

export function tierOfLevel(level: number): Difficulty {
  return TIERS[tierIndexOfLevel(level)].difficulty;
}

export function colorOfLevel(level: number): string {
  return TIERS[tierIndexOfLevel(level)].color;
}

function subRankOfLevel(level: number): number {
  // 티어 안에서의 순번(1~5). 1이 가장 약하고(V) 5가 가장 강하다(I).
  return ((clampLevel(level) - 1) % 5) + 1;
}

export function romanOfLevel(level: number): string {
  return ROMAN[subRankOfLevel(level) - 1];
}

/** 예: "골드 III" */
export function labelOfLevel(level: number): string {
  const l = clampLevel(level);
  return `${TIERS[tierIndexOfLevel(l)].label} ${romanOfLevel(l)}`;
}

/** 예: "G3" (골드 III). 숫자는 로마 숫자와 같은 값이어야 한다 (V=5 … I=1, 낮을수록 어려움). */
export function shortLabelOfLevel(level: number): string {
  const l = clampLevel(level);
  return `${TIERS[tierIndexOfLevel(l)].difficulty[0]}${6 - subRankOfLevel(l)}`;
}

export const TIER_OPTIONS: { difficulty: Difficulty; label: string; base: number }[] = [
  { difficulty: 'BRONZE', label: '브론즈', base: 0 },
  { difficulty: 'SILVER', label: '실버', base: 5 },
  { difficulty: 'GOLD', label: '골드', base: 10 },
  { difficulty: 'PLATINUM', label: '플래티넘', base: 15 },
  { difficulty: 'DIAMOND', label: '다이아몬드', base: 20 },
  { difficulty: 'RUBY', label: '루비', base: 25 },
];
