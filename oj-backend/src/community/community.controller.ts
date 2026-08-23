import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.strategy';
import { CommunityService } from './community.service';
import {
  BOARDS,
  CreateCommentDto,
  CreatePostDto,
  CreateTagDto,
  ResolveMentionsDto,
  VoteDto,
  type Board,
} from './dto/community.dto';
import type { OptionalAuthRequest } from '../common/http-request.types';

function parseBoard(raw: string | undefined): Board {
  const board = (raw ?? 'OJ').toUpperCase();
  if (!BOARDS.includes(board as Board)) {
    throw new BadRequestException('게시판 구분이 올바르지 않습니다.');
  }
  return board as Board;
}

@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  // 로그인 필요(보드별 권한은 서비스가 판별). optional 인증으로 받아 서비스에서 401/403을 던진다.
  @UseGuards(OptionalJwtAuthGuard)
  @Get('posts')
  listPosts(
    @Query('board') board: string | undefined,
    @Req() req: OptionalAuthRequest,
  ) {
    return this.community.listPosts(parseBoard(board), req.user?.userId, req.user?.role);
  }

  // ---- 태그(보드별). 정적 경로라 :id 라우트보다 먼저 선언한다. ----
  @UseGuards(OptionalJwtAuthGuard)
  @Get('tags')
  listTags(
    @Query('board') board: string | undefined,
    @Req() req: OptionalAuthRequest,
  ) {
    return this.community.listTags(parseBoard(board), req.user?.userId, req.user?.role);
  }

  /**
   * 작성 중인 본문에서 실제로 존재하는 멘션 대상을 알려준다(미리보기용).
   * 저장 전에는 서버가 본문을 모르므로 프론트가 초안을 보내 확인한다.
   */
  @UseGuards(JwtAuthGuard)
  @Post('mentions/resolve')
  resolveMentions(@Body() dto: ResolveMentionsDto) {
    return this.community.resolveMentions(dto.content ?? '');
  }

  // 게시글에 태그를 붙일 수 있는 사람이면(=로그인 사용자) 새 태그를 만들 수 있다.
  @UseGuards(JwtAuthGuard)
  @Post('tags')
  createTag(@Body() dto: CreateTagDto) {
    return this.community.createTag(dto.board, dto.name);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('posts/:id')
  getPost(@Param('id') id: string, @Req() req: OptionalAuthRequest) {
    return this.community.getPost(id, req.user?.userId, req.user?.role);
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts')
  createPost(@CurrentUser() user: RequestUser, @Body() dto: CreatePostDto) {
    return this.community.createPost(user.userId, user.role, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:id')
  deletePost(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.community.deletePost(id, user.userId, user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts/:id/vote')
  votePost(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: VoteDto,
  ) {
    return this.community.votePost(id, user.userId, dto.value);
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts/:id/comments')
  addComment(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.community.addComment(
      id,
      user.userId,
      dto.content,
      dto.parentId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('comments/:commentId')
  deleteComment(
    @Param('commentId') commentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.community.deleteComment(commentId, user.userId, user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Post('comments/:commentId/vote')
  voteComment(
    @Param('commentId') commentId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: VoteDto,
  ) {
    return this.community.voteComment(commentId, user.userId, dto.value);
  }
}
