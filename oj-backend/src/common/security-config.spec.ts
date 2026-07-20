import {
  requireFrontendOrigin,
  requireJwtSecret,
  requireSecureDatabaseUrl,
  resolveCorsOrigins,
} from './security-config';

const config = (values: Record<string, string | undefined>) => ({
  get: <T = string>(key: string) => values[key] as T | undefined,
});

describe('security configuration', () => {
  it('rejects missing, placeholder, and short JWT secrets', () => {
    expect(() => requireJwtSecret(config({}))).toThrow();
    expect(() => requireJwtSecret(config({ JWT_SECRET: 'dev_secret_change_me' }))).toThrow();
    expect(() => requireJwtSecret(config({ JWT_SECRET: 'short' }))).toThrow();
  });

  it('accepts a 256-bit-or-longer JWT secret', () => {
    expect(requireJwtSecret(config({ JWT_SECRET: 'a'.repeat(32) }))).toBe('a'.repeat(32));
  });

  it('rejects wildcard, credentialed, and path-bearing CORS origins', () => {
    expect(() => resolveCorsOrigins('*', true)).toThrow();
    expect(() => resolveCorsOrigins('https://user:pass@example.com', true)).toThrow();
    expect(() => resolveCorsOrigins('https://example.com/path', true)).toThrow();
  });

  it('deduplicates valid CORS origins', () => {
    expect(resolveCorsOrigins('https://a.example, https://a.example,http://localhost:8080', true)).toEqual([
      'https://a.example',
      'http://localhost:8080',
    ]);
  });

  it('requires one safe frontend origin in production', () => {
    expect(() => requireFrontendOrigin(config({}), true)).toThrow();
    expect(() => requireFrontendOrigin(config({ FRONTEND_URL: 'https://a.example,https://b.example' }), true)).toThrow();
    expect(requireFrontendOrigin(config({ FRONTEND_URL: 'https://oj.example' }), true)).toBe('https://oj.example');
  });

  it('rejects weak production database passwords', () => {
    expect(() =>
      requireSecureDatabaseUrl(config({ DATABASE_URL: 'postgresql://oj:oj_password@db/oj' }), true),
    ).toThrow();
    expect(() =>
      requireSecureDatabaseUrl(config({ DATABASE_URL: `postgresql://oj:${'a'.repeat(32)}@db/oj` }), true),
    ).not.toThrow();
  });
});
