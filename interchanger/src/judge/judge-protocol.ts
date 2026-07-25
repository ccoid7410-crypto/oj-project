/**
 * 채점 VM ↔ 인터체인저 ↔ API 사이에 오가는 페이로드 정의.
 *
 * 이 파일은 interchanger/src/judge/judge-protocol.ts 와 **바이트 단위로 동일**해야 한다.
 * (빌드 스크립트가 diff로 검사한다. 한쪽만 고치면 빌드가 깨진다.)
 *
 * 그래서 Prisma에서 생성된 타입($Enums.Language 등)을 절대 import하지 않는다 -
 * 인터체인저는 의도적으로 Prisma를 갖지 않는 프로세스이기 때문이다.
 */

export type JudgeVerdict =
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'RUNTIME_ERROR'
  | 'COMPILE_ERROR'
  | 'INTERNAL_ERROR';

export const JUDGE_VERDICTS: readonly JudgeVerdict[] = [
  'ACCEPTED',
  'WRONG_ANSWER',
  'TIME_LIMIT_EXCEEDED',
  'MEMORY_LIMIT_EXCEEDED',
  'RUNTIME_ERROR',
  'COMPILE_ERROR',
  'INTERNAL_ERROR',
];

export function isJudgeVerdict(value: unknown): value is JudgeVerdict {
  return typeof value === 'string' && (JUDGE_VERDICTS as readonly string[]).includes(value);
}

/** 채점기가 실제로 실행할 컴파일/실행 설정. API가 DB 오버라이드를 병합해 내려준다. */
export interface JudgeRunnerConfig {
  fileName: string;
  compileImage?: string;
  compileCmd: string[] | null;
  runImage: string;
  runCmd: string[];
}

export interface JudgeTestCase {
  id: string;
  input: string;
  output: string;
}

/**
 * 채점 한 건에 필요한 모든 것을 담은 자족적(self-contained) 페이로드.
 * 채점 VM은 DB에 접근할 수 없으므로 여기 없는 정보는 알 수 없다.
 */
export interface JudgeLease {
  leaseId: string;
  submissionId: string;
  /** 1 = 최초 배달, 2 = 리스 만료 후 재배달. 2까지 실패하면 INTERNAL_ERROR로 확정된다. */
  attempt: number;
  language: string;
  sourceCode: string;
  /** API에서 이미 clamp된 값. 채점기는 그대로 신뢰해서 쓴다. */
  timeLimitMs: number;
  memoryLimitMb: number;
  runnerConfig: JudgeRunnerConfig;
  testCases: JudgeTestCase[];
  /** epoch ms. 이 시각까지 heartbeat로 연장하지 않으면 리스가 회수된다. */
  expiresAt: number;
}

/**
 * API가 내려주는 채점 재료. 리스 메타데이터(leaseId/attempt/expiresAt)는
 * 인터체인저가 붙이므로 여기엔 없다.
 */
export type JudgePayload = Omit<JudgeLease, 'leaseId' | 'attempt' | 'expiresAt'>;

export interface JudgeTestResult {
  testCaseId: string;
  status: JudgeVerdict;
  runtimeMs: number;
  /** 최대 2000자로 잘라서 보낸다. */
  output: string;
}

export interface JudgeResult {
  leaseId: string;
  submissionId: string;
  status: JudgeVerdict;
  runtimeMs?: number;
  memoryKb?: number;
  /** 채점기가 4000자로 자르고, API가 저장 전에 한 번 더 자른다. */
  errorMessage?: string;
  testResults: JudgeTestResult[];
}

// ---- 요청/응답 봉투 ----

export interface LeaseRequest {
  workerId: string;
  /** JUDGE_CONCURRENCY - 현재 처리중 개수. 이 값 자체가 백프레셔 역할을 한다. */
  capacity: number;
}

export interface LeaseResponse {
  leases: JudgeLease[];
}

export interface HeartbeatRequest {
  leaseId: string;
}

export interface ResultResponse {
  /** 이미 처리된 리스에 대한 중복 보고였으면 true (무시됨). */
  duplicate: boolean;
}
