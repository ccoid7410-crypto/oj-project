import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { UPLOADS_ROOT, bannerBytesMatchMime, BANNER_EXTENSION_BY_MIME } from '../banner/banner.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { promises as fs, mkdirSync } from 'fs';
import { join } from 'path';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

try {
  mkdirSync(`${UPLOADS_ROOT}/images`, { recursive: true });
} catch (e) {}

@Controller('uploads')
export class UploadsController {
  @Post('image')
  @UseGuards(JwtAuthGuard) // 로그인한 유저 누구나 업로드 가능 (동아리 게시글 등 확장 고려)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: `${UPLOADS_ROOT}/images`,
        filename: (_req, file, cb) =>
          cb(null, `${randomUUID()}${BANNER_EXTENSION_BY_MIME[file.mimetype] ?? ''}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.has(file.mimetype)) {
          cb(new BadRequestException('png/jpeg/webp/gif 이미지만 업로드할 수 있습니다.'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(@UploadedFile() image?: Express.Multer.File) {
    if (!image) {
      throw new BadRequestException('이미지 파일이 없습니다.');
    }
    const bytes = await fs.readFile(image.path);
    if (!bannerBytesMatchMime(bytes, image.mimetype)) {
      await fs.unlink(image.path).catch(() => {});
      throw new BadRequestException('이미지 파일 내용이 선언한 형식과 일치하지 않습니다.');
    }
    
    // Nginx가 /api/ -> api:3000/ 로 프록시하므로 /api/uploads/images/...
    return { url: `/api/uploads/images/${image.filename}` };
  }
}
