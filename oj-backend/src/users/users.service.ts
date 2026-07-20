import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

export interface BulkUserSpec {
  username: string;
  email?: string;
  password?: string;
}

const BULK_CREATE_MAX = 100; // 관리자 토큰 탈취 시 피해 규모를 제한하기 위한 상한
const RANKING_DEFAULT_LIMIT = 50;
const RANKING_MAX_LIMIT = 100;

// 프로필 이미지는 클라이언트가 축소해서 올리지만(256px), 서버에서도 상한을 강제한다.
// DB(bytea)에 저장되므로 큰 이미지를 허용하면 저사양 호스트의 DB가 금방 부푼다.
const AVATAR_MAX_BYTES = 1024 * 1024; // 1MB
const BANNER_MAX_BYTES = 2 * 1024 * 1024; // 2MB (배너는 폭이 넓어 아바타보다 여유를 준다)
const AVATAR_ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
// 파일 시그니처(매직 넘버) 검사: Content-Type만 믿으면 SVG 등 스크립트 실행 가능한
// 포맷을 이미지로 위장해 올릴 수 있다.
const AVATAR_MAGIC: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF (+ 8~11바이트가 WEBP)
];

function randomPassword(): string {
  // 사람이 옮겨적기 쉬운 12자리 임시 비밀번호
  return randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12) + '1';
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** 본인 전용(GET /users/me). 로그인한 계정 자기 자신에게만 주는 정보라 email/studentId 등을 포함해도 된다. */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        preferredLanguage: true,
        role: true,
        customTitle: true,
        rating: true,
        studentId: true,
        mustChangePassword: true,
        createdAt: true,
        bio: true,
        websites: true,
        theme: true,
        avatarUpdatedAt: true,
        bannerUpdatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    // 기수: 이메일 아이디에서 처음 나오는 두 자리 숫자 (hallOfFame/clubProfile과 동일 규칙)
    const match = user.email.split('@')[0].match(/\d{2}/);
    const { avatarUpdatedAt, bannerUpdatedAt, ...rest } = user;
    return {
      ...rest,
      generation: match ? match[0] : null,
      avatarVersion: avatarUpdatedAt ? avatarUpdatedAt.getTime() : null,
      bannerVersion: bannerUpdatedAt ? bannerUpdatedAt.getTime() : null,
    };
  }

  /**
   * 공개 프로필(GET /users/:username, 로그인 불필요). 누구나 볼 수 있으므로
   * email/studentId/실명/정지 사유/가입일처럼 개인정보에 가까운 값은 절대 포함하지 않는다.
   */
  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        role: true,
        customTitle: true,
        rating: true,
        bio: true,
        websites: true,
        avatarUpdatedAt: true,
        bannerUpdatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

    const solved = await this.prisma.submission.findMany({
      where: {
        userId: user.id,
        status: 'ACCEPTED',
        problem: {
          status: 'PUBLISHED',
          NOT: { tags: { has: 'test' } },
          OR: [
            { contestOnly: false },
            {
              contestOnly: true,
              contestProblems: {
                some: { contest: { endsAt: { lt: new Date() }, problemsVisibleAfterEnd: true } },
              },
            },
          ],
        },
      },
      distinct: ['problemId'],
      select: {
        problem: { select: { id: true, displayId: true, title: true, slug: true, difficulty: true, level: true } },
      },
    });
    const solvedProblems = solved
      .map((s) => s.problem)
      .sort((a, b) => b.level - a.level)
      .slice(0, 50);

    const rank =
      user.rating > 0
        ? (await this.prisma.user.count({ where: { rating: { gt: user.rating } } })) + 1
        : null;

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      customTitle: user.customTitle,
      rating: user.rating,
      bio: user.bio,
      websites: user.websites,
      // 이미지 바이트 대신 버전(타임스탬프)만 내려준다. 프론트는 이 값으로
      // /users/:username/avatar?v=... URL을 만들고, null이면 기본(회색) 아바타를 그린다.
      avatarVersion: user.avatarUpdatedAt ? user.avatarUpdatedAt.getTime() : null,
      bannerVersion: user.bannerUpdatedAt ? user.bannerUpdatedAt.getTime() : null,
      solvedCount: solved.length,
      rank,
      solvedProblems,
    };
  }

  /** 본인 프로필 커스터마이징(bio/사이트 목록). 값 검증은 컨트롤러 DTO가 담당한다. */
  async updateProfile(userId: string, dto: { bio?: string | null; websites?: string[] }) {
    const data: { bio?: string | null; websites?: string[] } = {};
    if (dto.bio !== undefined) data.bio = dto.bio?.trim() || null;
    if (dto.websites !== undefined) {
      data.websites = dto.websites.map((w) => w.trim()).filter((w) => w !== '');
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, username: true, bio: true, websites: true },
    });
    return user;
  }

  /** 테마 설정(system/light/dark)을 계정에 저장한다. */
  async updateTheme(userId: string, theme: 'system' | 'light' | 'dark') {
    await this.prisma.user.update({ where: { id: userId }, data: { theme } });
    return { theme };
  }

  /** 프로필 이미지 업로드(base64). 형식/크기를 서버에서도 강제한다. */
  async updateAvatar(userId: string, mime: string, base64Data: string) {
    if (!AVATAR_ALLOWED_MIMES.has(mime)) {
      throw new BadRequestException('PNG/JPEG/WebP 이미지만 업로드할 수 있습니다.');
    }
    let bytes: Buffer;
    try {
      bytes = Buffer.from(base64Data, 'base64');
    } catch {
      throw new BadRequestException('이미지 데이터가 올바르지 않습니다.');
    }
    if (bytes.length === 0) throw new BadRequestException('이미지 데이터가 비어 있습니다.');
    if (bytes.length > AVATAR_MAX_BYTES) {
      throw new BadRequestException('이미지는 1MB 이하여야 합니다.');
    }
    const magic = AVATAR_MAGIC.find((m) => m.mime === mime)!;
    const matches =
      bytes.length > 12 &&
      magic.bytes.every((b, i) => bytes[i] === b) &&
      (mime !== 'image/webp' || bytes.subarray(8, 12).toString('ascii') === 'WEBP');
    if (!matches) {
      throw new BadRequestException('이미지 파일 내용이 형식과 일치하지 않습니다.');
    }
    const updatedAt = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      // Prisma 6의 Bytes는 Uint8Array 타입이라 Buffer를 그대로 못 넘긴다.
      data: { avatar: new Uint8Array(bytes), avatarMime: mime, avatarUpdatedAt: updatedAt },
    });
    return { avatarVersion: updatedAt.getTime() };
  }

  /** 프로필 이미지 삭제 → 기본(회색) 아바타로 되돌린다. */
  async deleteAvatar(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: null, avatarMime: null, avatarUpdatedAt: null },
    });
    return { avatarVersion: null };
  }

  /** 프로필 배너 업로드(base64). 아바타와 같은 검증에 크기 상한만 다르다. */
  async updateBanner(userId: string, mime: string, base64Data: string) {
    if (!AVATAR_ALLOWED_MIMES.has(mime)) {
      throw new BadRequestException('PNG/JPEG/WebP 이미지만 업로드할 수 있습니다.');
    }
    let bytes: Buffer;
    try {
      bytes = Buffer.from(base64Data, 'base64');
    } catch {
      throw new BadRequestException('이미지 데이터가 올바르지 않습니다.');
    }
    if (bytes.length === 0) throw new BadRequestException('이미지 데이터가 비어 있습니다.');
    if (bytes.length > BANNER_MAX_BYTES) {
      throw new BadRequestException('배너 이미지는 2MB 이하여야 합니다.');
    }
    const magic = AVATAR_MAGIC.find((m) => m.mime === mime)!;
    const matches =
      bytes.length > 12 &&
      magic.bytes.every((b, i) => bytes[i] === b) &&
      (mime !== 'image/webp' || bytes.subarray(8, 12).toString('ascii') === 'WEBP');
    if (!matches) {
      throw new BadRequestException('이미지 파일 내용이 형식과 일치하지 않습니다.');
    }
    const updatedAt = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      data: { banner: new Uint8Array(bytes), bannerMime: mime, bannerUpdatedAt: updatedAt },
    });
    return { bannerVersion: updatedAt.getTime() };
  }

  /** 프로필 배너 삭제. */
  async deleteBanner(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { banner: null, bannerMime: null, bannerUpdatedAt: null },
    });
    return { bannerVersion: null };
  }

  /** 공개 배너 이미지 조회. 없으면 null → 404 응답. */
  async getBanner(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { banner: true, bannerMime: true },
    });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    if (!user.banner || !user.bannerMime) return null;
    return { bytes: Buffer.from(user.banner), mime: user.bannerMime };
  }

  /** 공개 아바타 이미지 조회. 없으면 null(프론트가 기본 회색을 그림 → 404 응답). */
  async getAvatar(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { avatar: true, avatarMime: true, avatarUpdatedAt: true },
    });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    if (!user.avatar || !user.avatarMime) return null;
    return { bytes: Buffer.from(user.avatar), mime: user.avatarMime, updatedAt: user.avatarUpdatedAt };
  }

  /**
   * 랭킹 페이지(로그인 불필요, 공개). limit에 상한을 둬서 큰 값으로 DB에 부담 주는 걸 막고,
   * 응답에도 공개 프로필과 동일하게 username/rating/solvedCount 정도만 내려준다.
   */
  async ranking(limit = RANKING_DEFAULT_LIMIT) {
    const take = Math.min(Math.max(limit, 1), RANKING_MAX_LIMIT);
    const users = await this.prisma.user.findMany({
      where: { rating: { gt: 0 } },
      orderBy: { rating: 'desc' },
      take,
      select: { id: true, username: true, customTitle: true, rating: true, avatarUpdatedAt: true },
    });
    if (users.length === 0) return [];

    const userIds = users.map((u) => u.id);
    const rows = await this.prisma.$queryRaw<Array<{ userId: string; solvedCount: bigint }>>`
      SELECT "userId", COUNT(DISTINCT "problemId") AS "solvedCount"
      FROM submissions
      WHERE status = 'ACCEPTED' AND "userId" = ANY(${userIds})
      GROUP BY "userId"
    `;
    const solvedCounts = new Map(rows.map((r) => [r.userId, Number(r.solvedCount)]));

    return users.map((u, i) => ({
      rank: i + 1,
      username: u.username,
      customTitle: u.customTitle,
      rating: u.rating,
      avatarVersion: u.avatarUpdatedAt ? u.avatarUpdatedAt.getTime() : null,
      solvedCount: solvedCounts.get(u.id) ?? 0,
    }));
  }

  /**
   * 어드민 대량 계정 생성.
   * - role은 항상 USER로 고정한다. ADMIN 계정은 이 경로로 만들 수 없다(별도 절차 필요).
   * - specs: 개별 계정 목록. password/email 생략 시 자동 생성.
   * - 생성된 계정의 임시 비밀번호는 이 응답에서만 평문으로 반환되고, 최초 로그인 후 비밀번호 변경이 강제된다.
   */
  async bulkCreate(specs: BulkUserSpec[]) {
    if (!specs.length) throw new BadRequestException('생성할 계정이 없습니다.');
    if (specs.length > BULK_CREATE_MAX) {
      throw new BadRequestException(`한 번에 최대 ${BULK_CREATE_MAX}개까지 생성할 수 있습니다.`);
    }

    // 요청 내 중복 username 사전 차단
    const seen = new Set<string>();
    for (const s of specs) {
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(s.username)) {
        throw new BadRequestException(`username 형식 오류: ${s.username}`);
      }
      if (seen.has(s.username)) throw new BadRequestException(`요청 내 username 중복: ${s.username}`);
      seen.add(s.username);
    }

    const created: Array<{ username: string; email: string; password: string; role: string }> = [];
    const skipped: Array<{ username: string; reason: string }> = [];

    for (const s of specs) {
      const email = s.email ?? `${s.username}@oj.local`;
      const password = s.password ?? randomPassword();
      const exists = await this.prisma.user.findFirst({
        where: { OR: [{ username: s.username }, { email }] },
        select: { id: true },
      });
      if (exists) {
        skipped.push({ username: s.username, reason: '이미 존재하는 username/email' });
        continue;
      }
      const passwordHash = await bcrypt.hash(password, 10);
      await this.prisma.user.create({
        data: {
          username: s.username,
          email,
          passwordHash,
          role: 'USER', // bulk 경로로는 ADMIN을 만들 수 없다
          emailVerified: true, // 관리자가 직접 만든 계정이라 이메일 인증 절차를 요구하지 않는다
          mustChangePassword: true,
        },
      });
      created.push({ username: s.username, email, password, role: 'USER' });
    }

    return { createdCount: created.length, skippedCount: skipped.length, created, skipped };
  }

  /** count개 계정을 prefix0001 형태로 자동 생성. */
  async bulkGenerate(count: number, prefix: string) {
    if (count < 1 || count > BULK_CREATE_MAX) {
      throw new BadRequestException(`count는 1~${BULK_CREATE_MAX} 사이여야 합니다.`);
    }
    if (!/^[a-zA-Z0-9_]{1,15}$/.test(prefix)) throw new BadRequestException('prefix 형식 오류');
    const pad = String(count).length;
    const specs: BulkUserSpec[] = [];
    for (let i = 1; i <= count; i++) {
      specs.push({ username: `${prefix}${String(i).padStart(pad, '0')}` });
    }
    return this.bulkCreate(specs);
  }

  /** 어드민 계정 관리용 검색. username/email 부분 일치. (관리자 전용 엔드포인트라 email/정지사유 등 포함해도 됨) */
  async search(query: string) {
    const q = query.trim();
    return this.prisma.user.findMany({
      where: q
        ? { OR: [{ username: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] }
        : undefined,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        customTitle: true,
        rating: true,
        banned: true,
        bannedReason: true,
        bannedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * 계정 정지. 정지된 계정은 로그인/토큰 검증에서 즉시 차단된다(auth.service, jwt.strategy 참고).
   * 선생님(TEACHER)도 이 기능을 쓰지만("학생 계정 관리"), 학생(USER/MEMBER)만 정지할 수 있다 -
   * 다른 선생님이나 관리자를 정지시켜 버리는 걸 막는다.
   */
  async ban(id: string, reason: string | undefined, actingRole: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    if (user.role === 'ADMIN') throw new BadRequestException('관리자 계정은 정지할 수 없습니다.');
    if (actingRole === 'TEACHER' && user.role === 'TEACHER') {
      throw new ForbiddenException('선생님 계정은 정지할 수 없습니다.');
    }
    return this.prisma.user.update({
      where: { id },
      data: { banned: true, bannedReason: reason ?? null, bannedAt: new Date() },
      select: { id: true, username: true, banned: true, bannedReason: true, bannedAt: true },
    });
  }

  async unban(id: string, actingRole: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    if (actingRole === 'TEACHER' && (user.role === 'TEACHER' || user.role === 'ADMIN')) {
      throw new ForbiddenException('이 계정의 정지를 해제할 권한이 없습니다.');
    }
    return this.prisma.user.update({
      where: { id },
      data: { banned: false, bannedReason: null, bannedAt: null },
      select: { id: true, username: true, banned: true },
    });
  }

  /** 관리자가 지정하는 공개 칭호. 공백만 입력하면 칭호를 해제한다. */
  async setCustomTitle(id: string, title: string) {
    const customTitle = title.trim() || null;
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    return this.prisma.user.update({
      where: { id },
      data: { customTitle },
      select: { id: true, username: true, customTitle: true },
    });
  }

  /** 동아리 홈페이지 마이페이지/접속 제한용 본인 정보. 홈페이지 접속 자격은 role(MEMBER 이상)로 판단한다. */
  async clubProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, email: true, name: true, studentId: true, rating: true, role: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

    const match = user.email.split('@')[0].match(/\d{2}/);
    return {
      username: user.username,
      name: user.name,
      studentId: user.studentId,
      rating: user.rating,
      role: user.role,
      createdAt: user.createdAt,
      generation: match ? match[0] : null,
    };
  }

  /** 기본 제출 언어 설정. 문제 페이지에서 자동 선택된다. */
  async updatePreferredLanguage(userId: string, language: 'C' | 'CPP' | 'JAVA' | 'PYTHON3' | 'JAVASCRIPT' | 'GO') {
    return this.prisma.user.update({
      where: { id: userId },
      data: { preferredLanguage: language },
      select: { id: true, preferredLanguage: true },
    });
  }

  /**
   * 계정과 활동 기록(제출/댓글/투표/참가)을 완전히 삭제한다.
   * 이 계정이 만든 콘텐츠(문제/대회/수업/공지)가 있으면 다른 회원의 기록까지 얽혀 있어 막는다.
   */
  private async purgeAccount(id: string) {
    const [problemCount, contestCount, classCount, noticeCount] = await Promise.all([
      this.prisma.problem.count({ where: { authorId: id } }),
      this.prisma.contest.count({ where: { createdById: id } }),
      this.prisma.classRoom.count({ where: { createdById: id } }),
      this.prisma.classNotice.count({ where: { createdById: id } }),
    ]);
    if (problemCount > 0) {
      throw new BadRequestException('이 계정이 만든 문제가 있어 삭제할 수 없습니다. 문제를 먼저 삭제해주세요.');
    }
    if (contestCount > 0) {
      throw new BadRequestException('이 계정이 만든 대회가 있어 삭제할 수 없습니다. 대회를 먼저 삭제해주세요.');
    }
    if (classCount > 0) {
      throw new BadRequestException('이 계정이 만든 수업이 있어 삭제할 수 없습니다. 수업을 먼저 삭제해주세요.');
    }
    if (noticeCount > 0) {
      throw new BadRequestException('이 계정이 작성한 수업 공지가 있어 삭제할 수 없습니다. 공지를 먼저 삭제해주세요.');
    }

    await this.prisma.$transaction([
      // 남겨야 하는 기록에서 이 계정을 가리키는 참조만 비운다
      this.prisma.adminNotification.updateMany({ where: { voterId: id }, data: { voterId: null } }),
      this.prisma.problem.updateMany({ where: { reviewedById: id }, data: { reviewedById: null } }),
      // 본인의 활동 기록 삭제 (제출의 테스트 결과, 댓글의 대댓글은 cascade로 함께 삭제됨)
      this.prisma.submission.deleteMany({ where: { userId: id } }),
      this.prisma.problemComment.deleteMany({ where: { userId: id } }),
      this.prisma.problemDifficultyVote.deleteMany({ where: { userId: id } }),
      this.prisma.contestParticipant.deleteMany({ where: { userId: id } }),
      this.prisma.classMembership.deleteMany({ where: { userId: id } }),
      this.prisma.apiKey.deleteMany({ where: { createdById: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
    return { success: true };
  }

  /** 관리자: 계정 삭제. 관리자 계정은 먼저 권한을 해제해야 한다. */
  async adminDeleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    if (user.role === 'ADMIN') {
      throw new BadRequestException('관리자 계정은 삭제할 수 없습니다. 먼저 관리자 권한을 해제하세요.');
    }
    return this.purgeAccount(id);
  }

  /** 본인 탈퇴. 비밀번호 확인 필수, 관리자는 권한을 해제한 뒤에만 가능. */
  async deleteOwnAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    if (user.role === 'ADMIN') {
      throw new BadRequestException('관리자 계정은 탈퇴할 수 없습니다. 다른 관리자에게 권한 해제를 먼저 요청하세요.');
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) throw new ForbiddenException('비밀번호가 올바르지 않습니다.');
    return this.purgeAccount(userId);
  }

  /** 본인 이름(실명) 등록/수정. */
  async updateName(userId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('이름을 입력해주세요.');
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: trimmed },
      select: { id: true, name: true },
    });
  }

  /**
   * 명예의 전당: 동아리 부원(MEMBER 이상)만, 이메일 아이디에서 처음 나오는 두 자리
   * 숫자를 기수로 삼아 기수별로 묶는다 (예: cbsh38018@... -> 38기). 이메일 자체는 노출하지 않는다.
   */
  async hallOfFame() {
    const users = await this.prisma.user.findMany({
      where: { banned: false, role: { in: ['MEMBER', 'ADMIN'] } },
      select: { username: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { username: 'asc' }],
    });
    const byGeneration = new Map<string, { username: string; name: string | null }[]>();
    for (const u of users) {
      const match = u.email.split('@')[0].match(/\d{2}/);
      const key = match ? match[0] : '기타';
      if (!byGeneration.has(key)) byGeneration.set(key, []);
      byGeneration.get(key)!.push({ username: u.username, name: u.name });
    }
    // 기수 오름차순 정렬, 숫자가 없는 이메일(기타)은 맨 뒤로
    return [...byGeneration.entries()]
      .sort(([a], [b]) => {
        if (a === '기타') return 1;
        if (b === '기타') return -1;
        return Number(a) - Number(b);
      })
      .map(([generation, members]) => ({ generation, members }));
  }

  /** 권한 변경 (USER=일반, MEMBER=부원, ADMIN=관리자). 관리자 강등에는 잠금 사고 방지 장치가 걸려 있다. */
  async setRole(id: string, role: 'USER' | 'MEMBER' | 'TEACHER' | 'ADMIN', actingUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    if (user.role === role) {
      return { id: user.id, username: user.username, role: user.role };
    }
    // 관리자를 강등(ADMIN -> MEMBER/USER)할 때의 보호 장치들
    if (user.role === 'ADMIN') {
      if (user.isRootAdmin) {
        throw new BadRequestException('메인 관리자의 권한은 해제할 수 없습니다.');
      }
      if (id === actingUserId) {
        throw new BadRequestException('본인의 관리자 권한은 스스로 해제할 수 없습니다.');
      }
      const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        throw new BadRequestException('마지막 관리자의 권한은 해제할 수 없습니다.');
      }
    }
    if (role !== 'USER' && user.banned) {
      throw new BadRequestException('정지된 계정에는 권한을 부여할 수 없습니다.');
    }
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, username: true, role: true },
    });
  }

  /** 본인 비밀번호 변경. 대량 생성된 계정의 mustChangePassword 플래그도 여기서 해제된다. */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (Buffer.byteLength(newPassword, 'utf8') > 72) {
      throw new BadRequestException('새 비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) throw new ForbiddenException('현재 비밀번호가 올바르지 않습니다.');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      // authVersion을 올리면 비밀번호 변경 전에 발급된 JWT와 WebSocket 세션이 모두 무효화된다.
      data: { passwordHash, mustChangePassword: false, authVersion: { increment: 1 } },
    });
    return { success: true };
  }
}
