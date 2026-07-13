import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { CreateTestCaseDto, UpdateTestCaseDto } from './dto/testcase.dto';
import { CreateCommentDto } from './dto/comment.dto';

class VoteDifficultyDto {
  @IsInt()
  @Min(1)
  @Max(30)
  level: number;
}

@Controller('problems')
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(@Req() req: any) {
    // 로그인은 선택: 토큰이 있으면 각 문제에 내 정답/오답 여부(myStatus)를 같이 내려준다.
    return this.problemsService.findAllPublished(req.user?.userId, req.user?.role);
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
  findOne(@Param('slug') slug: string, @Query('contestId') contestId: string | undefined, @Req() req: any) {
    // 로그인은 선택: 토큰이 있으면 내 난이도 투표 여부/가능 여부를 같이 내려준다.
    return this.problemsService.findBySlug(slug, req.user?.userId, req.user?.role, contestId);
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

  // ---- 테스트케이스 관리 (작성자/어드민 전용) ----

  @UseGuards(JwtAuthGuard)
  @Get(':id/testcases')
  listTestCases(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.problemsService.listTestCases(id, user.userId, user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/testcases')
  addTestCase(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTestCaseDto,
  ) {
    return this.problemsService.addTestCase(id, user.userId, user.role, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/testcases/:testCaseId')
  updateTestCase(
    @Param('id') id: string,
    @Param('testCaseId') testCaseId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateTestCaseDto,
  ) {
    return this.problemsService.updateTestCase(id, testCaseId, user.userId, user.role, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/testcases/:testCaseId')
  deleteTestCase(
    @Param('id') id: string,
    @Param('testCaseId') testCaseId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.problemsService.deleteTestCase(id, testCaseId, user.userId, user.role);
  }

  // ---- 문제 Q&A 게시판 ----

  @Get(':id/comments')
  listComments(@Param('id') id: string) {
    return this.problemsService.listComments(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.problemsService.addComment(id, user.userId, dto.content, dto.parentId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/comments/:commentId')
  removeComment(@Param('commentId') commentId: string, @CurrentUser() user: RequestUser) {
    return this.problemsService.removeComment(commentId, user.userId, user.role);
  }
}
