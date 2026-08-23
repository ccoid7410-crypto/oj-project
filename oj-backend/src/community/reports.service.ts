import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import type {
  CreateReportDto,
  ReportActionValue,
  ReportTargetTypeValue,
} from './dto/report.dto';

const REASON_LABEL: Record<string, string> = {
  SPAM: '스팸·광고',
  ABUSE: '욕설·비방',
  ADULT: '음란물·부적절한 내용',
  PRIVACY: '개인정보 노출',
  FALSE_INFO: '허위 정보',
  ETC: '기타',
};

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: UserNotificationsService,
  ) {}

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

    // 신고자에게 접수 확인 알림을 보낸다(상세 페이지에서 신고 내용까지 볼 수 있게 본문에 담는다).
    const label = dto.targetType === 'POST' ? '게시글' : '댓글';
    await this.notifications.send({
      userId: reporterId,
      type: 'REPORT_RECEIVED',
      title: '신고가 접수되었습니다.',
      body: [
        `${label} 신고가 접수되었습니다. 관리자가 확인 후 처리합니다.`,
        '',
        `신고 종류: ${REASON_LABEL[dto.reason] ?? dto.reason}`,
        `신고 내용: ${dto.detail?.trim() || '(없음)'}`,
      ].join('\n'),
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
    // 같은 대상에 걸린 대기 신고를 모두 처리하므로, 그 신고자들에게 결과를 알린다.
    const affected = await this.prisma.communityReport.findMany({
      where: {
        targetType: report.targetType,
        targetId: report.targetId,
        status: 'PENDING',
      },
      select: { reporterId: true },
    });

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

    const resultText =
      action === 'DELETE_TARGET'
        ? '신고하신 내용이 확인되어 해당 글이 삭제되었습니다.'
        : '검토 결과 별도 조치가 필요하지 않다고 판단되어 종결되었습니다.';
    await Promise.all(
      [...new Set(affected.map((a) => a.reporterId))].map((userId) =>
        this.notifications.send({
          userId,
          type: 'REPORT_RESOLVED',
          title: '신고가 처리되었습니다.',
          body: note?.trim() ? `${resultText}\n\n관리자 메모: ${note.trim()}` : resultText,
        }),
      ),
    );

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
