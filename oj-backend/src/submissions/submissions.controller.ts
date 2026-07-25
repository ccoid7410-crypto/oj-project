import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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

  // 본인 제출 목록. ':id' 라우트보다 먼저 선언해야 'me'가 제출 ID로 잡히지 않는다.
  @Get('me')
  findMine(@CurrentUser() user: RequestUser, @Query('limit') limit?: string) {
    return this.submissionsService.findByUser(
      user.userId,
      limit ? Number(limit) : undefined,
    );
  }

  // 전체 사용자 채점 현황 피드. 로그인한 사용자면 누구나 볼 수 있다(소스코드는 포함되지 않음).
  @Get()
  findAll(@Query('limit') limit?: string) {
    return this.submissionsService.findAll(limit ? Number(limit) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.submissionsService.findById(id, user.userId, user.role);
  }
}
