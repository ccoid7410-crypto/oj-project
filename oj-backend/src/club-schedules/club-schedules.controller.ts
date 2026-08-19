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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER', 'ADMIN')
  @Get()
  list(@Query() range: ScheduleRangeDto) {
    return this.schedules.list(range);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('manage')
  listForManage() {
    return this.schedules.listForManage();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER', 'ADMIN')
  @Get('pending')
  listPending(@CurrentUser() user: RequestUser) {
    return this.schedules.listPending(user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER', 'ADMIN')
  @Post()
  propose(@CurrentUser() user: RequestUser, @Body() dto: SaveClubScheduleDto) {
    return this.schedules.propose(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER', 'ADMIN')
  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.schedules.approve(id, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER', 'ADMIN')
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: RejectClubScheduleDto,
  ) {
    return this.schedules.reject(id, user.userId, dto.reason);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: SaveClubScheduleDto,
  ) {
    return this.schedules.update(id, user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.schedules.remove(id);
  }
}
