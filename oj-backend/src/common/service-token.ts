import { createHash, timingSafeEqual } from 'crypto';

/** setup.sh가 아직 안 돌았을 때 .env.example에 들어있는 값들. 그대로면 기동을 막는다. */
const PLACEHOLDER_TOKENS = new Set(['', 'changeme-run-setup-sh', 'changeme']);

const MIN_TOKEN_BYTES = 32;

/**
 * 서비스 간 공유 토큰을 상수 시간으로 비교한다.
 *
 * 원문끼리 timingSafeEqual을 쓰면 길이가 다를 때 예외를 던진다 - 그 자체가 길이 오라클이고,
 * 가드 안에서 터지면 500이 나가면서 크래시 벡터가 된다. 그래서 양쪽을 sha256으로 먼저
 * 고정 길이(32바이트)로 만든 뒤 비교한다. (apikeys/apikey.service.ts가 API 키를 다루는 방식과 동일)
 */
export function serviceTokenMatches(presented: string | undefined | null, expected: string): boolean {
  if (!presented || !expected) return false;
  const a = createHash('sha256').update(presented, 'utf8').digest();
  const b = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b);
}

/**
 * 제시된 토큰이 현재 토큰 또는 직전 토큰(`*_PREV`) 중 하나와 일치하는지 확인한다.
 *
 * 무중단 로테이션 절차:
 *   1. 검증측 .env에 TOKEN_PREV=<기존값>, TOKEN=<새값> 설정 후 재시작
 *   2. 제시측을 새 값으로 교체 후 재시작
 *   3. 검증측에서 TOKEN_PREV 제거
 */
export function serviceTokenAccepted(
  presented: string | undefined | null,
  expected: string,
  expectedPrevious?: string,
): boolean {
  if (serviceTokenMatches(presented, expected)) return true;
  if (expectedPrevious && serviceTokenMatches(presented, expectedPrevious)) return true;
  return false;
}

/** `Authorization: Bearer <token>` 에서 토큰만 꺼낸다. 형식이 아니면 undefined. */
export function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, ...rest] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return undefined;
  const token = rest.join(' ').trim();
  return token || undefined;
}

/**
 * 기동 시점에 서비스 토큰이 실제로 쓸 만한 값인지 강제한다.
 * security-config.ts의 requireJwtSecret과 같은 fail-fast 철학:
 * 약한 토큰으로 조용히 뜨는 것보다 아예 안 뜨는 게 낫다.
 */
export function requireServiceToken(
  config: { get: (key: string) => string | undefined },
  key: string,
): string {
  const token = config.get(key)?.trim() ?? '';
  if (PLACEHOLDER_TOKENS.has(token) || Buffer.byteLength(token, 'utf8') < MIN_TOKEN_BYTES) {
    throw new Error(
      `${key}는 예시값이 아닌 ${MIN_TOKEN_BYTES}바이트 이상의 무작위 값이어야 합니다. ./setup.sh를 실행하세요.`,
    );
  }
  return token;
}
