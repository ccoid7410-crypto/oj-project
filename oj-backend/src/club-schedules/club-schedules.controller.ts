import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.strategy';
import { ClubSchedulesService } from './club-schedules.service';
import {
  RejectClubScheduleDto,
  SaveClubScheduleDto,
  ScheduleRangeDto,
} from './dto/club-schedule.dto';

@Controller('club-schedules')
export class ClubSchedulesController {
  constructor(private readonly schedules: ClubSchedulesService) {}

  // 캘린더 열람은 완전 공개: club-homepage/calendar.html이 비로그인 방문자에게도
  // 이 엔드포인트를 직접 호출하므로 인증 가드를 걸지 않는다.
  @Get()
  list(@Query() range: ScheduleRangeDto) {
    return this.schedules.list(range);
  }

  // 승인된 사용자 정의 종류 목록. 달력 범례·제안 폼이 쓰므로 목록과 같이 공개한다.
  @Get('custom-types')
  listCustomTypes() {
    return this.schedules.listCustomTypes();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('manage')
  listForManage() {
    return this.schedules.listForManage();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'MEMBER', 'TEACHER', 'ADMIN')
  @Get('pending')
  listPending(@CurrentUser() user: RequestUser) {
    return this.schedules.listPending(user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'MEMBER', 'TEACHER', 'ADMIN')
  @Post()
  propose(@CurrentUser() user: RequestUser, @Body() dto: SaveClubScheduleDto) {
    return this.schedules.propose(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'MEMBER', 'TEACHER', 'ADMIN')
  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.schedules.approve(id, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'MEMBER', 'TEACHER', 'ADMIN')
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: RejectClubScheduleDto,
  ) {
    return this.schedules.reject(id, user.userId, dto.reason);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'MEMBER', 'TEACHER', 'ADMIN')
  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: SaveClubScheduleDto,
  ) {
    return this.schedules.update(id, user.userId, user.role, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'MEMBER', 'TEACHER', 'ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.schedules.remove(id, user.userId, user.role);
  }
}
