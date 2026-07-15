import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.strategy';
import { CommunityService } from './community.service';
import { CreateCommentDto, CreatePostDto, VoteDto } from './dto/community.dto';

@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  // 목록/상세는 비로그인도 볼 수 있다(로그인 시 내 좋아요 표시를 위해 optional 인증).
  @UseGuards(OptionalJwtAuthGuard)
  @Get('posts')
  listPosts(@Req() req: any) {
    return this.community.listPosts(req.user?.userId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('posts/:id')
  getPost(@Param('id') id: string, @Req() req: any) {
    return this.community.getPost(id, req.user?.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts')
  createPost(@CurrentUser() user: RequestUser, @Body() dto: CreatePostDto) {
    return this.community.createPost(user.userId, dto.title, dto.content);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:id')
  deletePost(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.community.deletePost(id, user.userId, user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts/:id/vote')
  votePost(@Param('id') id: string, @CurrentUser() user: RequestUser, @Body() dto: VoteDto) {
    return this.community.votePost(id, user.userId, dto.value);
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts/:id/comments')
  addComment(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.community.addComment(id, user.userId, dto.content, dto.parentId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('comments/:commentId')
  deleteComment(@Param('commentId') commentId: string, @CurrentUser() user: RequestUser) {
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
