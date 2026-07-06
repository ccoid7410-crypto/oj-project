/**
 * 문제 난이도를 solved.ac 스타일로 세분화(1~30)한다.
 * 1~5=브론즈, 6~10=실버, 11~15=골드, 16~20=플래티넘, 21~25=다이아, 26~30=루비 (각 티어 안에서 V→I 순으로 어려워짐)
 *
 * 문제 레이팅(POINTS_BY_LEVEL)은 solved.ac의 공개되지 않은 실제 공식이 아니라,
 * "레벨이 오를수록 배점이 커지는" 형태만 유사하게 흉내 낸 우리 저지 자체의 근사치다.
 */
import { Difficulty } from '@prisma/client';

export const LEVEL_MIN = 1;
export const LEVEL_MAX = 30;

const TIERS: { difficulty: Difficulty; label: string }[] = [
  { difficulty: 'BRONZE', label: '브론즈' },
  { difficulty: 'SILVER', label: '실버' },
  { difficulty: 'GOLD', label: '골드' },
  { difficulty: 'PLATINUM', label: '플래티넘' },
  { difficulty: 'DIAMOND', label: '다이아몬드' },
  { difficulty: 'RUBY', label: '루비' },
];

const ROMAN = ['V', 'IV', 'III', 'II', 'I'];

export const POINTS_BY_LEVEL: number[] = [
  30, 60, 90, 120, 150, // 브론즈 V~I
  200, 300, 400, 500, 650, // 실버
  800, 950, 1100, 1250, 1400, // 골드
  1600, 1750, 1900, 2050, 2200, // 플래티넘
  2350, 2500, 2650, 2800, 2950, // 다이아몬드
  3100, 3300, 3500, 3750, 4000, // 루비
];

export function clampLevel(level: number): number {
  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Math.round(level)));
}

export function tierOfLevel(level: number): Difficulty {
  const l = clampLevel(level);
  const idx = Math.floor((l - 1) / 5);
  return TIERS[idx].difficulty;
}

export function labelOfLevel(level: number): string {
  const l = clampLevel(level);
  const tierIdx = Math.floor((l - 1) / 5);
  const roman = ROMAN[(l - 1) % 5];
  return `${TIERS[tierIdx].label} ${roman}`;
}

export function pointsOfLevel(level: number): number {
  const l = clampLevel(level);
  return POINTS_BY_LEVEL[l - 1];
}
