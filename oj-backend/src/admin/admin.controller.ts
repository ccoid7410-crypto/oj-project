import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  MaxLength,
  Matches,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.strategy';
import { UsersService } from '../users/users.service';
import type { BulkUserSpec } from '../users/users.service';
import { JudgeConfigService } from '../judge-config/judge-config.service';
import type { JudgeConfigMap } from '../judge-config/judge-config.service';
import { RatingService } from '../rating/rating.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StudentIdService } from '../student-id/student-id.service';
import { AdminStatsService } from './admin-stats.service';
import { ProblemsService } from '../problems/problems.service';
import { MailService } from '../mail/mail.service';
import { BannerService, UPLOADS_ROOT } from '../banner/banner.service';
import { RootAdminGuard } from './guards/root-admin.guard';

const BANNER_ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

class SetStudentIdWindowDto {
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
}

class BanUserDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

class SetRoleDto {
  @IsIn(['USER', 'MEMBER', 'ADMIN'])
  role: 'USER' | 'MEMBER' | 'ADMIN';
}

class SetCustomTitleDto {
  @IsString()
  @MaxLength(20, { message: '칭호는 20자 이하여야 합니다.' })
  @Matches(/^[^\r\n<>]*$/, { message: '칭호에 줄바꿈이나 <, > 문자를 사용할 수 없습니다.' })
  title: string;
}

// role은 의도적으로 받지 않는다: bulk 생성 경로로는 절대 ADMIN을 만들 수 없다
// (관리자 토큰이 탈취됐을 때 피해 범위를 USER 권한으로 제한하기 위함. ADMIN 생성은 별도 절차 필요).
class BulkUserItem {
  @IsString() username: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() password?: string;
}

class BulkCreateDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUserItem)
  users?: BulkUserItem[];

  // 자동 생성 모드
  @IsOptional() @IsInt() @Min(1) @Max(100) count?: number;
  @IsOptional() @IsString() prefix?: string;
}

class JudgeConfigUpdateDto {
  @IsObject()
  config: JudgeConfigMap;
}

class SendTestMailDto {
  @IsEmail()
  to: string;
}

class SaveGmailConfigDto {
  @IsEmail()
  from: string;

  @IsEmail()
  smtpUser: string;

  @IsOptional()
  @IsString()
  smtpPass?: string;
}

// multipart/form-data 필드는 전부 문자열로 들어오므로 boolean은 'true'/'false' 문자열로 받는다.
class SetBannerDto {
  @IsIn(['true', 'false'])
  enabled: 'true' | 'false';

  @IsOptional()
  @IsString()
  linkUrl?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly users: UsersService,
    private readonly judgeConfig: JudgeConfigService,
    private readonly rating: RatingService,
    private readonly notifications: NotificationsService,
    private readonly studentId: StudentIdService,
    private readonly stats: AdminStatsService,
    private readonly problems: ProblemsService,
    private readonly mail: MailService,
    private readonly banner: BannerService,
  ) {}

  // ---- 전체 현황 대시보드 ----
  @Get('stats/overview')
  overview() {
    return this.stats.overview();
  }

  // ---- 전체 문제 관리(삭제 포함, 상태 무관) ----
  @Get('problems')
  listAllProblems() {
    return this.problems.findAllForAdmin();
  }

  // ---- 대량 계정 생성 ----
  @Post('users/bulk')
  bulkUsers(@Body() dto: BulkCreateDto) {
    if (dto.count && dto.prefix) {
      return this.users.bulkGenerate(dto.count, dto.prefix);
    }
    return this.users.bulkCreate((dto.users ?? []) as BulkUserSpec[]);
  }

  // ---- 계정 검색/제재 ----
  @Get('users/search')
  searchUsers(@Query('q') q?: string) {
    return this.users.search(q ?? '');
  }

  @Post('users/:id/ban')
  banUser(@Param('id') id: string, @Body() dto: BanUserDto) {
    return this.users.ban(id, dto.reason);
  }

  @Post('users/:id/unban')
  unbanUser(@Param('id') id: string) {
    return this.users.unban(id);
  }

  // ---- 관리자 권한 부여/해제 ----
  @Post('users/:id/role')
  setUserRole(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: SetRoleDto) {
    return this.users.setRole(id, dto.role, user.userId);
  }

  // ---- 사용자별 공개 칭호 지정/해제 ----
  @Put('users/:id/custom-title')
  @UseGuards(RootAdminGuard)
  setUserCustomTitle(@Param('id') id: string, @Body() dto: SetCustomTitleDto) {
    return this.users.setCustomTitle(id, dto.title);
  }

  // ---- 계정 삭제 (활동 기록 포함, 되돌릴 수 없음) ----
  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.users.adminDeleteUser(id);
  }

  // ---- 관리자 알림 ----
  @Get('notifications')
  listNotifications(@Query('unread') unread?: string) {
    return this.notifications.list(unread === 'true');
  }

  @Get('notifications/unread-count')
  async unreadNotificationCount() {
    return { count: await this.notifications.unreadCount() };
  }

  @Post('notifications/:id/read')
  markNotificationRead(@Param('id') id: string) {
    return this.notifications.markRead(id);
  }

  @Post('notifications/read-all')
  markAllNotificationsRead() {
    return this.notifications.markAllRead();
  }

  // ---- 채점기 컴파일/실행 설정 ----
  @Get('judge-config')
  getJudgeConfig() {
    return this.judgeConfig.getEffective();
  }

  @Put('judge-config')
  setJudgeConfig(@CurrentUser() user: RequestUser, @Body() dto: JudgeConfigUpdateDto) {
    return this.judgeConfig.update(dto.config, user.userId);
  }

  @Post('judge-config/reset')
  resetJudgeConfig(@CurrentUser() user: RequestUser) {
    return this.judgeConfig.reset(user.userId);
  }

  // ---- 메일 발송 설정 ----
  @Get('mail/status')
  getMailStatus() {
    return this.mail.verifyConnection();
  }

  @Put('mail/gmail')
  saveGmailConfig(@CurrentUser() user: RequestUser, @Body() dto: SaveGmailConfigDto) {
    return this.mail.saveGmailConfig(dto, user.userId);
  }

  @Delete('mail/config')
  disableMailConfig(@CurrentUser() user: RequestUser) {
    return this.mail.disableDatabaseConfig(user.userId);
  }

  @Post('mail/test')
  sendTestMail(@Body() dto: SendTestMailDto) {
    return this.mail.sendTestEmail(dto.to);
  }

  // ---- 레이팅 ----
  /** 실제 제출 기록 기준으로 전체 유저 레이팅을 다시 계산한다 (마이그레이션/백필용). */
  @Post('rating/recompute-all')
  async recomputeAllRatings() {
    const count = await this.rating.recomputeAll();
    return { recomputedUsers: count };
  }

  // ---- 학번 수정 허용 기간 ----
  @Get('student-id/window')
  async getStudentIdWindow() {
    const window = await this.studentId.getWindow();
    return { ...window, isOpen: await this.studentId.isWindowOpen() };
  }

  @Put('student-id/window')
  async setStudentIdWindow(@CurrentUser() user: RequestUser, @Body() dto: SetStudentIdWindowDto) {
    const window = await this.studentId.setWindow(
      dto.startsAt ? new Date(dto.startsAt) : null,
      dto.endsAt ? new Date(dto.endsAt) : null,
      user.userId,
    );
    return { ...window, isOpen: await this.studentId.isWindowOpen() };
  }

  // ---- 동아리 홈페이지 상단 배너 ----
  @Get('banner')
  getBanner() {
    return this.banner.getAdmin();
  }

  @Put('banner')
  @UseGuards(RootAdminGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: `${UPLOADS_ROOT}/banner`,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB - 배너 하나에 그 이상은 과하다
      fileFilter: (_req, file, cb) => {
        if (!BANNER_ALLOWED_MIME.has(file.mimetype)) {
          cb(new BadRequestException('png/jpeg/webp/gif 이미지만 업로드할 수 있습니다.'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  setBanner(
    @CurrentUser() user: RequestUser,
    @Body() dto: SetBannerDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.banner.save(
      { enabled: dto.enabled === 'true', linkUrl: dto.linkUrl?.trim() || null, newFile: image },
      user.userId,
    );
  }

  @Delete('banner')
  @UseGuards(RootAdminGuard)
  removeBanner(@CurrentUser() user: RequestUser) {
    return this.banner.remove(user.userId);
  }
}
