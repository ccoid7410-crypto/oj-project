import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, resolve, sep } from 'path';
import { PrismaService } from '../prisma/prisma.service';

export type PublicBanner = {
  enabled: boolean;
  imageUrl: string | null;
  linkUrl: string | null;
};

export type AdminBanner = PublicBanner & {
  updatedAt: string | null;
};

// 컨테이너 안에서는 항상 /app이 WORKDIR이므로 이 경로가 곧 볼륨 마운트 지점과 일치한다
// (docker-compose에서 banner_uploads 볼륨을 /app/uploads에 마운트해 재배포해도 파일이 남는다).
export const UPLOADS_ROOT = join(process.cwd(), 'uploads');
const BANNER_DIR = join(UPLOADS_ROOT, 'banner');

export const BANNER_EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function bannerBytesMatchMime(bytes: Buffer, mime: string): boolean {
  if (mime === 'image/png') {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (mime === 'image/webp') {
    return bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (mime === 'image/gif') {
    const signature = bytes.subarray(0, 6).toString('ascii');
    return signature === 'GIF87a' || signature === 'GIF89a';
  }
  return false;
}

export function normalizeBannerLink(value: string | null): string | null {
  if (!value?.trim()) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new BadRequestException('배너 링크가 올바른 URL이 아닙니다.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new BadRequestException('배너 링크는 인증정보가 없는 http/https URL이어야 합니다.');
  }
  return url.toString();
}

@Injectable()
export class BannerService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublic(): Promise<PublicBanner> {
    const row = await this.prisma.siteBanner.findUnique({ where: { id: 1 } });
    if (!row || !row.enabled || !row.imagePath) {
      return { enabled: false, imageUrl: null, linkUrl: null };
    }
    return { enabled: true, imageUrl: this.toImageUrl(row.imagePath), linkUrl: row.linkUrl };
  }

  async getAdmin(): Promise<AdminBanner> {
    const row = await this.prisma.siteBanner.findUnique({ where: { id: 1 } });
    if (!row) return { enabled: false, imageUrl: null, linkUrl: null, updatedAt: null };
    return {
      enabled: row.enabled,
      imageUrl: row.imagePath ? this.toImageUrl(row.imagePath) : null,
      linkUrl: row.linkUrl,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** 새 이미지 업로드(선택) + enabled/linkUrl 저장. 새 파일이 오면 기존 파일은 지운다. */
  async save(
    input: { enabled: boolean; linkUrl: string | null; newFile?: Express.Multer.File },
    updatedById: string,
  ): Promise<AdminBanner> {
    const current = await this.prisma.siteBanner.findUnique({ where: { id: 1 } });
    const linkUrl = normalizeBannerLink(input.linkUrl);

    let imagePath = current?.imagePath ?? null;
    let newRelativePath: string | null = null;
    if (input.newFile) {
      newRelativePath = join('banner', input.newFile.filename);
      const bytes = await fs.readFile(input.newFile.path);
      if (!bannerBytesMatchMime(bytes, input.newFile.mimetype)) {
        await this.deleteFile(newRelativePath);
        throw new BadRequestException('이미지 파일 내용이 선언한 형식과 일치하지 않습니다.');
      }
      imagePath = newRelativePath;
    }

    if (input.enabled && !imagePath) {
      // 업로드된 이미지가 없으면 켤 수 없다 - DB에는 저장해도 실제로 보여줄 게 없어 혼란만 생긴다.
      throw new BadRequestException('배너를 켜려면 이미지를 먼저 업로드해야 합니다.');
    }

    try {
      await this.prisma.siteBanner.upsert({
        where: { id: 1 },
        create: { id: 1, enabled: input.enabled, imagePath, linkUrl, updatedById },
        update: { enabled: input.enabled, imagePath, linkUrl, updatedById },
      });
    } catch (error) {
      if (newRelativePath) await this.deleteFile(newRelativePath);
      throw error;
    }

    // DB가 새 파일을 가리키기 시작한 뒤에만 기존 파일을 지운다. 저장 실패 시 기존 배너가 깨지지 않는다.
    if (newRelativePath && current?.imagePath && current.imagePath !== newRelativePath) {
      await this.deleteFile(current.imagePath);
    }

    return this.getAdmin();
  }

  async remove(updatedById: string): Promise<AdminBanner> {
    const current = await this.prisma.siteBanner.findUnique({ where: { id: 1 } });
    if (current?.imagePath) await this.deleteFile(current.imagePath);

    await this.prisma.siteBanner.upsert({
      where: { id: 1 },
      create: { id: 1, enabled: false, imagePath: null, linkUrl: null, updatedById },
      update: { enabled: false, imagePath: null, linkUrl: null, updatedById },
    });

    return this.getAdmin();
  }

  private toImageUrl(imagePath: string): string {
    // nginx가 /api/ -> api:3000/ 로 프록시하므로, 프론트/홈페이지 어디서든 항상 /api/uploads/...
    // 상대경로로 접근 가능하다(같은 origin, CORS 없음).
    return `/api/uploads/${imagePath.replace(/\\/g, '/')}`;
  }

  private async deleteFile(imagePath: string): Promise<void> {
    const root = resolve(UPLOADS_ROOT);
    const target = resolve(root, imagePath);
    if (target === root || !target.startsWith(`${root}${sep}`)) return;
    try {
      await fs.unlink(target);
    } catch {
      // 파일이 이미 없어도(수동 삭제 등) 무시한다 - DB 상태 갱신이 우선이다.
    }
  }
}

export { BANNER_DIR };
