import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { requireJwtSecret } from '../common/security-config';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  ver: number;
}

export interface RequestUser {
  userId: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret(configService),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    // 발급 이후 계정이 정지되거나 권한(role)이 바뀌었을 수 있으니 매 요청마다 DB로 다시 확인한다.
    // (JWT payload의 role은 로그인 시점 스냅샷이라, 관리자가 방금 권한을 회수해도 토큰이 살아있는
    //  동안은 그대로 admin 행세를 할 수 있는 문제가 있었다 - 여기서 항상 최신 role을 반환해서 막는다)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        banned: true,
        role: true,
        emailVerified: true,
        mustChangePassword: true,
        authVersion: true,
      },
    });
    if (!user || user.banned || !user.emailVerified || payload.ver !== user.authVersion) {
      throw new UnauthorizedException('유효하지 않거나 만료된 로그인 정보입니다.');
    }
    // 여기서 리턴하는 값이 req.user 에 들어감
    return {
      userId: payload.sub,
      email: payload.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
