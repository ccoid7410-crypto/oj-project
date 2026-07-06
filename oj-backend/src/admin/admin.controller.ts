import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  IsArray,
  IsDateString,
  IsInt,
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

class RosterEntryDto {
  @IsString() studentId: string;
  @IsOptional() @IsString() name?: string;
}

class BulkRosterDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RosterEntryDto)
  entries: RosterEntryDto[];
}

class SetStudentIdWindowDto {
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
}

class BanUserDto {
  @IsOptional()
  @IsString()
  reason?: string;
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

  // ---- 레이팅 ----
  /** 실제 제출 기록 기준으로 전체 유저 레이팅을 다시 계산한다 (마이그레이션/백필용). */
  @Post('rating/recompute-all')
  async recomputeAllRatings() {
    const count = await this.rating.recomputeAll();
    return { recomputedUsers: count };
  }

  // ---- 동아리 학번 명단 ----
  @Get('student-id/roster')
  listRoster() {
    return this.studentId.listRoster();
  }

  @Post('student-id/roster')
  bulkAddRoster(@Body() dto: BulkRosterDto) {
    return this.studentId.bulkAddRoster(dto.entries);
  }

  @Delete('student-id/roster/:id')
  removeRoster(@Param('id') id: string) {
    return this.studentId.removeRoster(id);
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
}
