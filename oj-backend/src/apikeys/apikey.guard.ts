import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from './apikey.service';
import { API_KEY_SCOPES_KEY } from './require-scopes.decorator';

/** x-api-key 헤더(또는 Authorization: ApiKey <key>)를 검증하는 서비스간 인증 가드. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger('ApiKeyAccess');

  constructor(
    private readonly apiKeys: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header = req.headers['x-api-key'];
    const authz = req.headers['authorization'];
    let raw: string | undefined = Array.isArray(header) ? header[0] : header;
    if (!raw && typeof authz === 'string' && authz.startsWith('ApiKey ')) {
      raw = authz.slice('ApiKey '.length);
    }
    const key = await this.apiKeys.verify(raw ?? '');
    if (!key) throw new UnauthorizedException('유효하지 않은 API 키입니다.');

    const requiredScopes = this.reflector.getAllAndOverride<string[]>(API_KEY_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredScopes?.length) {
      const missing = requiredScopes.filter((s) => !key.scopes.includes(s));
      if (missing.length) {
        throw new ForbiddenException(`이 API 키에는 다음 scope가 없습니다: ${missing.join(', ')}`);
      }
    }

    req.apiKey = key;
    this.logger.log(
      `key="${key.name}"(${key.id}) ${req.method} ${req.originalUrl ?? req.url} from ${req.ip ?? 'unknown-ip'}`,
    );
    return true;
  }
}
