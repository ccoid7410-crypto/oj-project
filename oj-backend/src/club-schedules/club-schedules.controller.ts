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
import { SaveClubScheduleDto, ScheduleRangeDto } from './dto/club-schedule.dto';

@Controller('club-schedules')
export class ClubSchedulesController {
  constructor(private readonly schedules: ClubSchedulesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER', 'TEACHER', 'ADMIN')
  @Get()
  list(@Query() range: ScheduleRangeDto) {
    return this.schedules.list(range);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: SaveClubScheduleDto) {
    return this.schedules.create(user.userId, dto);
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
