import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// 작성자 표시용 최소 정보(문제 Q&A 댓글과 동일 규칙): 아바타는 버전만 내려서
// 프론트가 /users/:username/avatar?v= 로 그리게 한다.
const AUTHOR_SELECT = {
  select: { username: true, customTitle: true, avatarUpdatedAt: true },
} as const;

type AuthorRow = { username: string; customTitle: string | null; avatarUpdatedAt: Date | null };

function mapAuthor(u: AuthorRow) {
  return {
    username: u.username,
    customTitle: u.customTitle,
    avatarVersion: u.avatarUpdatedAt ? u.avatarUpdatedAt.getTime() : null,
  };
}

/** 좋아요/싫어요 배열을 {likeCount, dislikeCount, myVote}로 요약한다. */
function summarizeVotes(votes: Array<{ value: number; userId: string }>, requesterId?: string) {
  let likeCount = 0;
  let dislikeCount = 0;
  let myVote = 0;
  for (const v of votes) {
    if (v.value === 1) likeCount++;
    else if (v.value === -1) dislikeCount++;
    if (requesterId && v.userId === requesterId) myVote = v.value;
  }
  return { likeCount, dislikeCount, myVote };
}

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  /** 게시글 목록. 최신순. 각 글의 댓글 수와 좋아요/싫어요 집계를 함께 내려준다. */
  async listPosts(requesterId?: string) {
    const posts = await this.prisma.communityPost.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        author: AUTHOR_SELECT,
        votes: { select: { value: true, userId: true } },
        _count: { select: { comments: true } },
      },
    });
    return posts.map((p) => ({
      id: p.id,
      title: p.title,
      author: mapAuthor(p.author),
      createdAt: p.createdAt,
      commentCount: p._count.comments,
      ...summarizeVotes(p.votes, requesterId),
    }));
  }

  /** 게시글 상세 + 댓글/답글(평면 목록, parentId로 트리 구성은 프론트가 담당). */
  async getPost(id: string, requesterId?: string) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id },
      include: {
        author: AUTHOR_SELECT,
        votes: { select: { value: true, userId: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: AUTHOR_SELECT,
            votes: { select: { value: true, userId: true } },
          },
        },
      },
    });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');

    return {
      id: post.id,
      title: post.title,
      content: post.content,
      author: mapAuthor(post.author),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      ...summarizeVotes(post.votes, requesterId),
      comments: post.comments.map((c) => ({
        id: c.id,
        content: c.content,
        parentId: c.parentId,
        createdAt: c.createdAt,
        user: mapAuthor(c.user),
        ...summarizeVotes(c.votes, requesterId),
      })),
    };
  }

  async createPost(authorId: string, title: string, content: string) {
    const post = await this.prisma.communityPost.create({
      data: { authorId, title, content },
    });
    return { id: post.id };
  }

  async deletePost(id: string, requesterId: string, requesterRole: string) {
    const post = await this.prisma.communityPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    if (post.authorId !== requesterId && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('이 게시글을 삭제할 권한이 없습니다.');
    }
    // 댓글/답글/좋아요는 onDelete cascade로 함께 삭제된다.
    await this.prisma.communityPost.delete({ where: { id } });
    return { success: true };
  }

  /** 게시글 좋아요/싫어요. 같은 값을 다시 누르면 취소(토글)한다. */
  async votePost(postId: string, userId: string, value: 1 | -1) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    const existing = await this.prisma.communityPostVote.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    if (existing && existing.value === value) {
      await this.prisma.communityPostVote.delete({ where: { postId_userId: { postId, userId } } });
    } else {
      await this.prisma.communityPostVote.upsert({
        where: { postId_userId: { postId, userId } },
        create: { postId, userId, value },
        update: { value },
      });
    }
    const votes = await this.prisma.communityPostVote.findMany({
      where: { postId },
      select: { value: true, userId: true },
    });
    return summarizeVotes(votes, userId);
  }

  async addComment(postId: string, userId: string, content: string, parentId?: string) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    if (parentId) {
      const parent = await this.prisma.communityComment.findUnique({ where: { id: parentId } });
      if (!parent || parent.postId !== postId) {
        throw new NotFoundException('답글 대상을 찾을 수 없습니다.');
      }
    }
    const created = await this.prisma.communityComment.create({
      data: { postId, userId, content, parentId },
    });
    return { id: created.id };
  }

  async deleteComment(commentId: string, requesterId: string, requesterRole: string) {
    const comment = await this.prisma.communityComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('댓글을 찾을 수 없습니다.');
    if (comment.userId !== requesterId && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('이 댓글을 삭제할 권한이 없습니다.');
    }
    // 답글/좋아요는 onDelete cascade로 함께 삭제된다.
    await this.prisma.communityComment.delete({ where: { id: commentId } });
    return { success: true };
  }

  /** 댓글/답글 좋아요/싫어요. 같은 값을 다시 누르면 취소(토글)한다. */
  async voteComment(commentId: string, userId: string, value: 1 | -1) {
    const comment = await this.prisma.communityComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('댓글을 찾을 수 없습니다.');
    const existing = await this.prisma.communityCommentVote.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });
    if (existing && existing.value === value) {
      await this.prisma.communityCommentVote.delete({
        where: { commentId_userId: { commentId, userId } },
      });
    } else {
      await this.prisma.communityCommentVote.upsert({
        where: { commentId_userId: { commentId, userId } },
        create: { commentId, userId, value },
        update: { value },
      });
    }
    const votes = await this.prisma.communityCommentVote.findMany({
      where: { commentId },
      select: { value: true, userId: true },
    });
    return summarizeVotes(votes, userId);
  }
}
