import {
  extractBearerToken,
  requireServiceToken,
  serviceTokenAccepted,
  serviceTokenMatches,
} from './service-token';

const config = (values: Record<string, string | undefined>) => ({
  get: (key: string) => values[key],
});

const STRONG = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);

describe('service token', () => {
  it('matches identical tokens and rejects different ones', () => {
    expect(serviceTokenMatches(STRONG, STRONG)).toBe(true);
    expect(serviceTokenMatches(OTHER, STRONG)).toBe(false);
  });

  it('rejects empty/missing tokens instead of matching them', () => {
    expect(serviceTokenMatches(undefined, STRONG)).toBe(false);
    expect(serviceTokenMatches(null, STRONG)).toBe(false);
    expect(serviceTokenMatches('', STRONG)).toBe(false);
    // 기대값이 비어 있으면(설정 누락) 무엇을 제시해도 통과하면 안 된다.
    expect(serviceTokenMatches(STRONG, '')).toBe(false);
  });

  it('does not throw on length mismatch (raw timingSafeEqual would)', () => {
    expect(() => serviceTokenMatches('short', STRONG)).not.toThrow();
    expect(serviceTokenMatches('short', STRONG)).toBe(false);
  });

  it('accepts the previous token during rotation, and nothing else', () => {
    expect(serviceTokenAccepted(OTHER, STRONG, OTHER)).toBe(true);
    expect(serviceTokenAccepted(STRONG, STRONG, OTHER)).toBe(true);
    expect(serviceTokenAccepted('c'.repeat(64), STRONG, OTHER)).toBe(false);
    // 이전 토큰이 설정돼 있지 않으면 현재 토큰만 통과한다.
    expect(serviceTokenAccepted(OTHER, STRONG)).toBe(false);
  });

  it('extracts only well-formed bearer headers', () => {
    expect(extractBearerToken(`Bearer ${STRONG}`)).toBe(STRONG);
    expect(extractBearerToken(`bearer ${STRONG}`)).toBe(STRONG);
    expect(extractBearerToken(`ApiKey ${STRONG}`)).toBeUndefined();
    expect(extractBearerToken('Bearer')).toBeUndefined();
    expect(extractBearerToken('Bearer    ')).toBeUndefined();
    expect(extractBearerToken(undefined)).toBeUndefined();
  });

  it('rejects missing, placeholder, and short service tokens at boot', () => {
    expect(() => requireServiceToken(config({}), 'JUDGE_SERVICE_TOKEN')).toThrow();
    expect(() =>
      requireServiceToken(config({ JUDGE_SERVICE_TOKEN: 'changeme-run-setup-sh' }), 'JUDGE_SERVICE_TOKEN'),
    ).toThrow();
    expect(() =>
      requireServiceToken(config({ JUDGE_SERVICE_TOKEN: 'a'.repeat(31) }), 'JUDGE_SERVICE_TOKEN'),
    ).toThrow();
  });

  it('accepts a 32-byte-or-longer service token', () => {
    expect(requireServiceToken(config({ JUDGE_SERVICE_TOKEN: STRONG }), 'JUDGE_SERVICE_TOKEN')).toBe(STRONG);
  });
});
