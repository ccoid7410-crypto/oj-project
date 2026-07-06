import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.strategy';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@UseGuards(JwtAuthGuard)
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  // 채점 큐 남용 방지: 유저 1명당 1분에 20회까지만 제출 가능.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSubmissionDto) {
    return this.submissionsService.create(user.userId, user.role, dto);
  }

  @Get('me')
  findMine(@CurrentUser() user: RequestUser) {
    return this.submissionsService.findByUser(user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.submissionsService.findById(id, user.userId, user.role);
  }
}
