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

// 메인 관리자 기본값. 이 계정은 누구도 관리자 권한을 해제할 수 없다.
// 서버 .env의 ROOT_ADMIN_USERNAME이 설정돼 있으면 그 값이 우선한다.
const DEFAULT_ROOT_ADMIN_USERNAME = 'jihun1050';

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
        role: true,
        rating: true,
        studentId: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    return user;
  }

  /**
   * 공개 프로필(GET /users/:username, 로그인 불필요). 누구나 볼 수 있으므로
   * email/studentId/실명/정지 사유/가입일처럼 개인정보에 가까운 값은 절대 포함하지 않는다.
   */
  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, role: true, rating: true },
    });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

    const solved = await this.prisma.submission.findMany({
      where: { userId: user.id, status: 'ACCEPTED' },
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
      rating: user.rating,
      solvedCount: solved.length,
      rank,
      solvedProblems,
    };
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
      select: { id: true, username: true, rating: true },
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
      rating: u.rating,
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
        email: true,
        role: true,
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

  /** 계정 정지. 정지된 계정은 로그인/토큰 검증에서 즉시 차단된다(auth.service, jwt.strategy 참고). */
  async ban(id: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    if (user.role === 'ADMIN') throw new BadRequestException('관리자 계정은 정지할 수 없습니다.');
    return this.prisma.user.update({
      where: { id },
      data: { banned: true, bannedReason: reason ?? null, bannedAt: new Date() },
      select: { id: true, username: true, banned: true, bannedReason: true, bannedAt: true },
    });
  }

  async unban(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    return this.prisma.user.update({
      where: { id },
      data: { banned: false, bannedReason: null, bannedAt: null },
      select: { id: true, username: true, banned: true },
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
      select: { username: true, email: true },
      orderBy: { username: 'asc' },
    });
    const byGeneration = new Map<string, string[]>();
    for (const u of users) {
      const match = u.email.split('@')[0].match(/\d{2}/);
      const key = match ? match[0] : '기타';
      if (!byGeneration.has(key)) byGeneration.set(key, []);
      byGeneration.get(key)!.push(u.username);
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
  async setRole(id: string, role: 'USER' | 'MEMBER' | 'ADMIN', actingUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    if (user.role === role) {
      return { id: user.id, username: user.username, role: user.role };
    }
    // 관리자를 강등(ADMIN -> MEMBER/USER)할 때의 보호 장치들
    if (user.role === 'ADMIN') {
      const rootAdmin = process.env.ROOT_ADMIN_USERNAME?.trim() || DEFAULT_ROOT_ADMIN_USERNAME;
      if (user.username === rootAdmin) {
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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) throw new ForbiddenException('현재 비밀번호가 올바르지 않습니다.');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    return { success: true };
  }
}
