import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.strategy';
import { ProblemsService } from './problems.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';

class VoteDifficultyDto {
  @IsInt()
  @Min(1)
  @Max(30)
  level: number;
}

@Controller('problems')
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Get()
  findAll() {
    return this.problemsService.findAllPublished();
  }

  // 정적 경로는 반드시 ':slug' 파라미터 라우트보다 먼저 선언해야 매칭이 가로채이지 않는다.
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  findMine(@CurrentUser() user: RequestUser) {
    return this.problemsService.findMine(user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('proposals')
  findProposals() {
    return this.problemsService.findProposals();
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug')
  findOne(@Param('slug') slug: string, @Req() req: any) {
    // 로그인은 선택: 토큰이 있으면 내 난이도 투표 여부/가능 여부를 같이 내려준다.
    return this.problemsService.findBySlug(slug, req.user?.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/difficulty-vote')
  voteDifficulty(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: VoteDifficultyDto,
  ) {
    return this.problemsService.voteDifficulty(id, user.userId, dto.level);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateProblemDto) {
    return this.problemsService.create(user.userId, user.role, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/submit-review')
  submitReview(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.problemsService.submitForReview(id, user.userId, user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.problemsService.approve(id, user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body('note') note: string,
  ) {
    return this.problemsService.reject(id, user.userId, note);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProblemDto,
  ) {
    return this.problemsService.update(id, user.userId, user.role, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id/publish')
  publish(@Param('id') id: string) {
    return this.problemsService.publish(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':id/apply-community-difficulty')
  applyCommunityDifficulty(@Param('id') id: string) {
    return this.problemsService.applyCommunityDifficulty(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.problemsService.remove(id, user.userId, user.role);
  }
}
