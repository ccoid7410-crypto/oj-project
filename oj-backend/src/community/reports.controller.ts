import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.strategy';
import { CreateReportDto, ResolveReportDto } from './dto/report.dto';
import { ReportsService } from './reports.service';

@Controller('community/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** 신고 접수. 로그인한 사용자면 누구나 할 수 있다. */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateReportDto) {
    return this.reports.create(user.userId, dto);
  }

  /** 관리자용 신고 목록(대상 원문 미리보기 포함). */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get()
  list(@Query('status') status?: string) {
    return this.reports.list(status);
  }

  /** 처리 대기 중인 신고 수(관리자 메뉴 뱃지용). */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('pending-count')
  pendingCount() {
    return this.reports.pendingCount();
  }

  /** 신고 처리: 대상 삭제 또는 기각. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':id/resolve')
  resolve(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ResolveReportDto,
  ) {
    return this.reports.resolve(id, user.userId, dto.action, dto.note);
  }
}
