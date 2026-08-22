import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateReportDto,
  ReportActionValue,
  ReportTargetTypeValue,
} from './dto/report.dto';

/** 관리자 목록에서 신고 대상 원문을 같이 보여주기 위한 요약. */
type TargetPreview = {
  exists: boolean;
  board: string | null;
  postId: string | null;
  title: string | null;
  content: string;
  authorUsername: string | null;
  isReply: boolean;
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 신고 접수. 같은 사람이 같은 대상을 두 번 신고하면 막는다. */
  async create(reporterId: string, dto: CreateReportDto) {
    await this.assertTargetExists(dto.targetType, dto.targetId);

    const duplicate = await this.prisma.communityReport.findUnique({
      where: {
        reporterId_targetType_targetId: {
          reporterId,
          targetType: dto.targetType,
          targetId: dto.targetId,
        },
      },
    });
    if (duplicate) {
      throw new BadRequestException('이미 신고한 대상입니다.');
    }

    const report = await this.prisma.communityReport.create({
      data: {
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        detail: dto.detail?.trim() ?? '',
        reporterId,
      },
    });
    return { id: report.id, status: report.status };
  }

  /** 관리자 목록. status로 걸러 보고, 대상 원문 미리보기를 함께 내려준다. */
  async list(status?: string) {
    const known = ['PENDING', 'ACTION_TAKEN', 'DISMISSED'] as const;
    const filter = known.find((s) => s === status);
    const where: Prisma.CommunityReportWhereInput = filter
      ? { status: filter }
      : {};
    const reports = await this.prisma.communityReport.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      include: {
        reporter: { select: { username: true } },
        handledBy: { select: { username: true } },
      },
    });

    return Promise.all(
      reports.map(async (r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        detail: r.detail,
        status: r.status,
        reporter: r.reporter?.username ?? null,
        handledBy: r.handledBy?.username ?? null,
        handledAt: r.handledAt?.toISOString() ?? null,
        handlerNote: r.handlerNote,
        createdAt: r.createdAt.toISOString(),
        target: await this.loadTarget(r.targetType, r.targetId),
      })),
    );
  }

  async pendingCount() {
    const count = await this.prisma.communityReport.count({
      where: { status: 'PENDING' },
    });
    return { count };
  }

  /**
   * 신고 처리. DELETE_TARGET이면 신고된 글/댓글을 지우고, DISMISS면 그대로 두고 기각한다.
   * 어느 쪽이든 같은 대상에 걸린 다른 대기 신고도 함께 정리해서 목록에 중복이 남지 않게 한다.
   */
  async resolve(
    id: string,
    adminId: string,
    action: ReportActionValue,
    note?: string,
  ) {
    const report = await this.prisma.communityReport.findUnique({
      where: { id },
    });
    if (!report) throw new NotFoundException('신고를 찾을 수 없습니다.');
    if (report.status !== 'PENDING') {
      throw new BadRequestException('이미 처리된 신고입니다.');
    }

    if (action === 'DELETE_TARGET') {
      await this.deleteTarget(report.targetType, report.targetId);
    }

    const status = action === 'DELETE_TARGET' ? 'ACTION_TAKEN' : 'DISMISSED';
    await this.prisma.communityReport.updateMany({
      where: {
        targetType: report.targetType,
        targetId: report.targetId,
        status: 'PENDING',
      },
      data: {
        status,
        handledById: adminId,
        handledAt: new Date(),
        handlerNote: note?.trim() ?? '',
      },
    });
    return { status };
  }

  private async assertTargetExists(
    targetType: ReportTargetTypeValue,
    targetId: string,
  ) {
    const found =
      targetType === 'POST'
        ? await this.prisma.communityPost.findUnique({
            where: { id: targetId },
            select: { id: true },
          })
        : await this.prisma.communityComment.findUnique({
            where: { id: targetId },
            select: { id: true },
          });
    if (!found) {
      throw new NotFoundException('신고 대상을 찾을 수 없습니다.');
    }
  }

  private async deleteTarget(
    targetType: ReportTargetTypeValue,
    targetId: string,
  ) {
    if (targetType === 'POST') {
      await this.prisma.communityPost.deleteMany({ where: { id: targetId } });
    } else {
      // 답글은 부모 댓글에 cascade로 딸려 삭제된다.
      await this.prisma.communityComment.deleteMany({ where: { id: targetId } });
    }
  }

  private async loadTarget(
    targetType: ReportTargetTypeValue,
    targetId: string,
  ): Promise<TargetPreview> {
    const empty: TargetPreview = {
      exists: false,
      board: null,
      postId: null,
      title: null,
      content: '',
      authorUsername: null,
      isReply: false,
    };

    if (targetType === 'POST') {
      const post = await this.prisma.communityPost.findUnique({
        where: { id: targetId },
        include: { author: { select: { username: true } } },
      });
      if (!post) return empty;
      return {
        exists: true,
        board: post.board,
        postId: post.id,
        title: post.title,
        content: post.content.slice(0, 500),
        authorUsername: post.author?.username ?? null,
        isReply: false,
      };
    }

    const comment = await this.prisma.communityComment.findUnique({
      where: { id: targetId },
      include: {
        user: { select: { username: true } },
        post: { select: { id: true, board: true, title: true } },
      },
    });
    if (!comment) return empty;
    return {
      exists: true,
      board: comment.post?.board ?? null,
      postId: comment.post?.id ?? null,
      title: comment.post?.title ?? null,
      content: comment.content.slice(0, 500),
      authorUsername: comment.user?.username ?? null,
      isReply: Boolean(comment.parentId),
    };
  }
}
