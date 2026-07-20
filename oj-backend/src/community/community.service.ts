import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Board, PostType } from './dto/community.dto';

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

  /**
   * 게시글 목록. 공지(NOTICE)를 최상단에 고정하고, 그 안/밖 모두 최신순으로 정렬한다.
   * OJ/HOME 보드는 같은 백엔드를 쓰지만 board로 분리되어 서로 글을 공유하지 않는다.
   */
  async listPosts(board: Board, requesterId?: string) {
    const posts = await this.prisma.communityPost.findMany({
      where: { board },
      orderBy: { createdAt: 'desc' },
      include: {
        author: AUTHOR_SELECT,
        votes: { select: { value: true, userId: true } },
        _count: { select: { comments: true } },
      },
    });
    const mapped = posts.map((p) => ({
      id: p.id,
      type: p.type,
      title: p.title,
      tags: p.tags,
      author: mapAuthor(p.author),
      createdAt: p.createdAt,
      commentCount: p._count.comments,
      ...summarizeVotes(p.votes, requesterId),
    }));
    // 공지를 상단 고정(둘 다 이미 최신순이라 순서만 앞뒤로 나눈다).
    const notices = mapped.filter((p) => p.type === 'NOTICE');
    const rest = mapped.filter((p) => p.type !== 'NOTICE');
    return [...notices, ...rest];
  }

  /** 게시글 상세 + 댓글/답글(평면 목록, 정렬은 프론트가 담당). */
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
      board: post.board,
      type: post.type,
      title: post.title,
      content: post.content,
      tags: post.tags,
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

  async createPost(
    authorId: string,
    authorRole: string,
    dto: { board: Board; title: string; content: string; type?: PostType; tags?: string[] },
  ) {
    // 공지(NOTICE) 유형은 어드민만 지정할 수 있다.
    const type: PostType = dto.type ?? 'NORMAL';
    if (type === 'NOTICE' && authorRole !== 'ADMIN') {
      throw new ForbiddenException('공지 유형은 관리자만 작성할 수 있습니다.');
    }
    const tags = (dto.tags ?? []).map((t) => t.trim()).filter(Boolean);
    // 게시글에 쓴 태그는 해당 보드의 태그 목록에도 등록해 다른 사람이 재사용할 수 있게 한다.
    for (const name of new Set(tags)) {
      await this.prisma.communityTag.upsert({
        where: { board_name: { board: dto.board, name } },
        create: { board: dto.board, name },
        update: {},
      });
    }
    const post = await this.prisma.communityPost.create({
      data: { board: dto.board, type, title: dto.title, content: dto.content, tags, authorId },
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

  // ---- 태그(보드별 태그 풀) ----

  listTags(board: Board) {
    return this.prisma.communityTag.findMany({
      where: { board },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async createTag(board: Board, name: string) {
    const trimmed = name.trim();
    // 이미 있으면 그대로 반환(중복 생성해도 에러 대신 기존 것을 돌려줌).
    const existing = await this.prisma.communityTag.findUnique({
      where: { board_name: { board, name: trimmed } },
    });
    if (existing) return { id: existing.id, name: existing.name };
    const created = await this.prisma.communityTag.create({
      data: { board, name: trimmed },
      select: { id: true, name: true },
    });
    return created;
  }
}
