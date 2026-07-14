import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
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

    let imagePath = current?.imagePath ?? null;
    if (input.newFile) {
      const relativePath = join('banner', input.newFile.filename);
      if (current?.imagePath) await this.deleteFile(current.imagePath);
      imagePath = relativePath;
    }

    if (input.enabled && !imagePath) {
      // 업로드된 이미지가 없으면 켤 수 없다 - DB에는 저장해도 실제로 보여줄 게 없어 혼란만 생긴다.
      throw new Error('배너를 켜려면 이미지를 먼저 업로드해야 합니다.');
    }

    await this.prisma.siteBanner.upsert({
      where: { id: 1 },
      create: { id: 1, enabled: input.enabled, imagePath, linkUrl: input.linkUrl, updatedById },
      update: { enabled: input.enabled, imagePath, linkUrl: input.linkUrl, updatedById },
    });

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
    try {
      await fs.unlink(join(UPLOADS_ROOT, imagePath));
    } catch {
      // 파일이 이미 없어도(수동 삭제 등) 무시한다 - DB 상태 갱신이 우선이다.
    }
  }
}

export { BANNER_DIR };
