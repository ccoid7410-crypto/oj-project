export type JudgeStatus =
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'RUNTIME_ERROR'
  | 'COMPILE_ERROR'
  | 'INTERNAL_ERROR';

// 숫자가 클수록 "더 심각한" 상태. 여러 테스트케이스 중 최종 상태를 고를 때 사용.
const SEVERITY: Record<JudgeStatus, number> = {
  ACCEPTED: 0,
  WRONG_ANSWER: 1,
  MEMORY_LIMIT_EXCEEDED: 2,
  TIME_LIMIT_EXCEEDED: 2,
  RUNTIME_ERROR: 3,
  COMPILE_ERROR: 4,
  INTERNAL_ERROR: 5,
};

export function worseStatus(a: JudgeStatus, b: JudgeStatus): JudgeStatus {
  return SEVERITY[b] > SEVERITY[a] ? b : a;
}

/** 표준 출력 비교: 줄 끝 공백/개행 차이는 무시 (일반적인 OJ 채점 관례) */
export function outputsMatch(expected: string, actual: string): boolean {
  const normalize = (s: string) =>
    s
      .split('\n')
      .map((line) => line.replace(/\s+$/g, ''))
      .join('\n')
      .replace(/\n+$/g, '');
  return normalize(expected) === normalize(actual);
}
