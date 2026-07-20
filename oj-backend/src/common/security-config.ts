import type { ConfigService } from '@nestjs/config';

const INSECURE_JWT_SECRETS = new Set([
  'dev_secret_change_me',
  'changeme-run-setup-sh',
  'secret',
]);

/** HS256 키는 최소 256비트의 예측 불가능한 값을 요구한다. */
export function requireJwtSecret(config: Pick<ConfigService, 'get'>): string {
  const secret = config.get<string>('JWT_SECRET')?.trim() ?? '';
  if (Buffer.byteLength(secret, 'utf8') < 32 || INSECURE_JWT_SECRETS.has(secret)) {
    throw new Error('JWT_SECRET은 예시값이 아닌 32바이트 이상의 무작위 값이어야 합니다.');
  }
  return secret;
}

/** 운영 DB가 예시 비밀번호로 기동되는 것을 막는다. */
export function requireSecureDatabaseUrl(
  config: Pick<ConfigService, 'get'>,
  production: boolean,
): void {
  if (!production) return;
  const raw = config.get<string>('DATABASE_URL') ?? '';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('운영 환경의 DATABASE_URL이 올바르지 않습니다.');
  }
  const password = decodeURIComponent(url.password);
  if (Buffer.byteLength(password, 'utf8') < 16 || ['oj_password', 'changeme-run-setup-sh'].includes(password)) {
    throw new Error('운영 데이터베이스 비밀번호는 예시값이 아닌 16바이트 이상의 값이어야 합니다.');
  }
}

export function requireFrontendOrigin(
  config: Pick<ConfigService, 'get'>,
  production: boolean,
): string {
  const raw = config.get<string>('FRONTEND_URL')?.trim();
  if (!raw) {
    if (production) throw new Error('운영 환경에서는 FRONTEND_URL을 반드시 설정해야 합니다.');
    return 'http://localhost:5173';
  }
  if (raw.includes(',')) throw new Error('FRONTEND_URL에는 하나의 origin만 설정해야 합니다.');
  return resolveCorsOrigins(raw, true)[0];
}

/** CORS origin은 스킴+호스트+선택적 포트만 허용한다. 와일드카드/경로/인증정보는 거부한다. */
export function resolveCorsOrigins(raw: string | undefined, production: boolean): string[] {
  if (!raw?.trim()) {
    if (production) {
      throw new Error('운영 환경에서는 CORS_ORIGIN 환경변수를 반드시 설정해야 합니다 (콤마로 구분).');
    }
    return ['http://localhost:5173'];
  }

  const origins = [...new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))];
  if (origins.length === 0) throw new Error('CORS_ORIGIN에 유효한 origin이 없습니다.');

  for (const origin of origins) {
    if (origin === '*' || origin === 'null') {
      throw new Error(`허용할 수 없는 CORS origin입니다: ${origin}`);
    }
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`CORS origin 형식이 올바르지 않습니다: ${origin}`);
    }
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error(`CORS origin은 http(s) 스킴과 호스트(선택적 포트)만 포함해야 합니다: ${origin}`);
    }
  }

  return origins;
}
