import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationType =
  | 'REPORT_RECEIVED'
  | 'REPORT_RESOLVED'
  | 'MENTION'
  | 'ADMIN_MESSAGE';

/** 본문 안의 @사용자명 표기를 뽑아낸다. 실제 존재 여부는 호출부에서 확인한다. */
export function extractMentions(text: string): string[] {
  // 사용자명은 영문/숫자/밑줄/하이픈. 이메일(@ 앞에 글자가 붙은 경우)은 걸리지 않게 앞을 확인한다.
  const matches = text.matchAll(/(^|[^\w@])@([A-Za-z0-9_-]{2,30})/g);
  return [...new Set([...matches].map((m) => m[2]))];
}

@Injectable()
export class UserNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * sender에 담긴 이름이 실제 계정이면 아바타 정보까지 같이 내려준다.
   * 프론트는 그때만 프로필 사진 + 아이디 칩(누르면 사용자 페이지)으로 그리고,
   * 시스템 발신("Durunuri OJ")은 이름만 표시한다.
   */
  private async senderProfiles(names: string[]) {
    const unique = [...new Set(names)];
    if (unique.length === 0) return new Map<string, number | null>();
    const users = await this.prisma.user.findMany({
      where: { username: { in: unique } },
      select: { username: true, avatarUpdatedAt: true },
    });
    return new Map(
      users.map((u) => [
        u.username,
        u.avatarUpdatedAt ? u.avatarUpdatedAt.getTime() : null,
      ]),
    );
  }

  async list(userId: string) {
    const rows = await this.prisma.userNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const profiles = await this.senderProfiles(rows.map((n) => n.sender));
    return rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      sender: n.sender,
      // 실제 계정이 아니면 null(시스템 발신)
      senderUsername: profiles.has(n.sender) ? n.sender : null,
      senderAvatarVersion: profiles.get(n.sender) ?? null,
      linkUrl: n.linkUrl,
      read: Boolean(n.readAt),
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async get(id: string, userId: string) {
    const n = await this.prisma.userNotification.findUnique({ where: { id } });
    if (!n || n.userId !== userId) {
      throw new NotFoundException('알림을 찾을 수 없습니다.');
    }
    // 상세를 열면 읽음 처리한다.
    if (!n.readAt) {
      await this.prisma.userNotification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    }
    const profiles = await this.senderProfiles([n.sender]);
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      sender: n.sender,
      senderUsername: profiles.has(n.sender) ? n.sender : null,
      senderAvatarVersion: profiles.get(n.sender) ?? null,
      linkUrl: n.linkUrl,
      read: true,
      createdAt: n.createdAt.toISOString(),
    };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.userNotification.count({
      where: { userId, readAt: null },
    });
    return { count };
  }

  async markAllRead(userId: string) {
    await this.prisma.userNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  /** 알림 하나 보내기. 내부 이벤트(신고·멘션)와 관리자 발송이 모두 이걸 쓴다. */
  async send(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    sender?: string;
    linkUrl?: string;
  }) {
    return this.prisma.userNotification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title.slice(0, 200),
        body: params.body ?? '',
        sender: params.sender ?? 'Durunuri OJ',
        linkUrl: params.linkUrl ?? '',
      },
    });
  }

  /**
   * 본문에서 실제로 존재하는 사용자명만 골라 멘션 알림을 보낸다.
   * 자기 자신은 제외한다. 존재하지 않는 이름은 조용히 무시한다(멘션이 아닐 수 있으므로).
   */
  async notifyMentions(params: {
    content: string;
    actorId: string;
    actorUsername: string;
    where: string;
    linkUrl: string;
  }) {
    const names = extractMentions(params.content);
    if (names.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { username: { in: names }, id: { not: params.actorId } },
      select: { id: true, username: true },
    });

    await Promise.all(
      users.map((u) =>
        this.send({
          userId: u.id,
          type: 'MENTION',
          title: `${params.actorUsername}님이 회원님을 언급했습니다.`,
          body: `${params.where}에서 회원님을 언급했습니다.\n\n${params.content.slice(0, 300)}`,
          sender: params.actorUsername,
          linkUrl: params.linkUrl,
        }),
      ),
    );
    return users.map((u) => u.username);
  }

  /** 본문에 등장한 사용자명 중 실제로 존재하는 것들(프론트가 멘션 칩으로 그린다). */
  async resolveMentions(content: string) {
    const names = extractMentions(content);
    if (names.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { username: { in: names } },
      select: { username: true, avatarUpdatedAt: true },
    });
    return users.map((u) => ({
      username: u.username,
      avatarVersion: u.avatarUpdatedAt ? u.avatarUpdatedAt.getTime() : null,
    }));
  }
}
