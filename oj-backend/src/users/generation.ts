/**
 * 기수 계산. 학번 8자리 중 앞 4자리가 입학년도이고, 2026년 입학이 38기다.
 * (예: 20260001 → 38기, 20250012 → 37기)
 *
 * 학번이 없거나 형식이 다르면 null이고, 명예의 전당에서는 '기타'로 묶인다.
 * 예전에는 이메일에서 기수를 뽑았는데, 개인 이메일은 알 수 없는 데다
 * 학번에 이미 입학년도가 들어 있어서 학번 기준으로 바꿨다.
 */
const BASE_YEAR = 2026;
const BASE_GENERATION = 38;

export function generationFromStudentId(studentId: string | null): string | null {
  if (!studentId) return null;
  const match = /^(\d{4})\d{4}$/.exec(studentId.trim());
  if (!match) return null;
  const generation = BASE_GENERATION + (Number(match[1]) - BASE_YEAR);
  return generation > 0 ? String(generation) : null;
}
