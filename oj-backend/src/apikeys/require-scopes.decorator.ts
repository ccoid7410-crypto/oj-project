import { SetMetadata } from '@nestjs/common';

export const API_KEY_SCOPES_KEY = 'apiKeyScopes';

/** 이 엔드포인트를 호출하려면 API 키가 가진 scopes에 여기 나열한 값이 전부 포함돼 있어야 한다. */
export const RequireScopes = (...scopes: string[]) => SetMetadata(API_KEY_SCOPES_KEY, scopes);
