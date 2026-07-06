import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.strategy';
import { ContestsService } from './contests.service';
import { CreateContestDto, SetContestProblemsDto } from './dto/contest.dto';

@Controller('contests')
export class ContestsController {
  constructor(private readonly contests: ContestsService) {}

  @Get()
  list() {
    return this.contests.list();
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug')
  findOne(@Param('slug') slug: string, @Req() req: any) {
    // 로그인은 선택: 토큰이 있으면 registered 여부를 채워준다.
    return this.contests.findBySlug(slug, req.user?.userId);
  }

  @Get(':slug/leaderboard')
  leaderboard(@Param('slug') slug: string) {
    return this.contests.leaderboard(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateContestDto) {
    return this.contests.create(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Put(':id/problems')
  setProblems(@Param('id') id: string, @Body() dto: SetContestProblemsDto) {
    return this.contests.setProblems(id, dto.problems);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/register')
  register(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.contests.register(id, user.userId);
  }
}
