import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StudentIdService } from '../student-id/student-id.service';
import { MailService } from '../mail/mail.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

function sha256(v: string): string {
  return createHash('sha256').update(v).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly studentId: StudentIdService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** 허용 이메일 도메인. 학교 계정으로만 가입을 받기 위함 (env로 바꿀 수 있게 하되 기본값은 cbsh.hs.kr). */
  private get allowedEmailDomain(): string {
    return this.config.get<string>('SIGNUP_EMAIL_DOMAIN', 'cbsh.hs.kr').toLowerCase();
  }

  async signup(dto: SignupDto) {
    const domain = dto.email.split('@')[1]?.toLowerCase();
    if (domain !== this.allowedEmailDomain) {
      throw new BadRequestException(`@${this.allowedEmailDomain} 이메일로만 가입할 수 있습니다.`);
    }

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) {
      throw new ConflictException('이미 사용 중인 이메일 또는 username 입니다.');
    }

    // 학번 명단(화이트리스트)은 가입을 막는 용도가 아니라 문제 등록 자격 검증에 쓴다 (problems.service 참고).
    if (dto.studentId) {
      const studentIdTaken = await this.prisma.user.findUnique({ where: { studentId: dto.studentId } });
      if (studentIdTaken) throw new ConflictException('이미 다른 계정에 등록된 학번입니다.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        studentId: dto.studentId ?? null,
      },
    });

    await this.issueAndSendVerification(user.id, user.email);

    // 이메일 인증 전에는 로그인할 수 없으므로, 여기서는 토큰을 주지 않고 안내만 반환한다.
    return {
      requiresEmailVerification: true,
      message: `${user.email}로 인증 메일을 보냈습니다. 메일함을 확인해주세요.`,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    if (user.banned) {
      throw new ForbiddenException(`정지된 계정입니다.${user.bannedReason ? ` 사유: ${user.bannedReason}` : ''}`);
    }
    if (!user.emailVerified) {
      throw new ForbiddenException('이메일 인증이 필요합니다. 메일함을 확인하거나 인증 메일을 다시 요청하세요.');
    }

    return this.buildAuthResponse(user);
  }

  private async issueAndSendVerification(userId: string, email: string) {
    const raw = randomBytes(32).toString('hex');
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
      },
    });
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const verifyUrl = `${frontendUrl}/verify-email?token=${raw}`;
    await this.mail.sendVerificationEmail(email, verifyUrl);
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // 계정 존재 여부를 굳이 노출하지 않는다 (이메일 존재 여부 스캐닝 방지).
    if (!user || user.emailVerified) {
      return { message: '해당 이메일이 가입돼 있고 아직 인증 전이라면 인증 메일을 다시 보냈습니다.' };
    }
    await this.issueAndSendVerification(user.id, user.email);
    return { message: '해당 이메일이 가입돼 있고 아직 인증 전이라면 인증 메일을 다시 보냈습니다.' };
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('유효하지 않거나 만료된 인증 링크입니다.');
    }

    const user = await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    });
    // 재사용 방지: 이 유저의 남은 인증 토큰을 전부 정리한다.
    await this.prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });

    if (user.banned) {
      throw new ForbiddenException(`정지된 계정입니다.${user.bannedReason ? ` 사유: ${user.bannedReason}` : ''}`);
    }

    // 인증 완료 직후에는 그대로 로그인시켜 UX를 매끄럽게 한다.
    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
    username: string;
    role: string;
    studentId?: string | null;
    mustChangePassword?: boolean;
  }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        studentId: user.studentId ?? null,
        mustChangePassword: user.mustChangePassword ?? false,
      },
    };
  }
}
