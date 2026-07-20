import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

function sha256(v: string): string {
  return createHash('sha256').update(v).digest('hex');
}

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  /** 새 API 키 발급. 원문 키는 이 시점에만 반환되고 이후에는 해시만 저장된다. */
  async create(createdById: string, name: string, scopes?: string[]) {
    const requestedScopes = scopes?.length ? [...new Set(scopes)] : ['users:read'];
    if (requestedScopes.some((scope) => scope !== 'users:read')) {
      throw new BadRequestException('허용되지 않는 API 키 scope입니다.');
    }
    const raw = 'ojk_' + randomBytes(24).toString('hex');
    const record = await this.prisma.apiKey.create({
      data: {
        name,
        keyHash: sha256(raw),
        prefix: raw.slice(0, 12),
        scopes: requestedScopes,
        createdById,
      },
      select: { id: true, name: true, prefix: true, scopes: true, createdAt: true },
    });
    // 원문 키(key)는 여기서만 노출
    return { ...record, key: raw };
  }

  async list() {
    return this.prisma.apiKey.findMany({
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        createdAt: true,
        lastUsedAt: true,
        revoked: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(id: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException('API 키를 찾을 수 없습니다.');
    await this.prisma.apiKey.update({ where: { id }, data: { revoked: true } });
    return { success: true };
  }

  /** 요청 헤더의 원문 키를 검증하고 유효하면 키 레코드를 반환. lastUsedAt 갱신. */
  async verify(rawKey: string) {
    if (!rawKey) return null;
    const key = await this.prisma.apiKey.findUnique({ where: { keyHash: sha256(rawKey) } });
    if (!key || key.revoked) return null;
    await this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    return key;
  }
}
