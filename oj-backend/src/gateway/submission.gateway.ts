import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { SUBMISSION_UPDATES_CHANNEL } from '../judge/judge.processor';
import type { JwtPayload } from '../auth/jwt.strategy';
import { requireJwtSecret, resolveCorsOrigins } from '../common/security-config';

// 데코레이터 인자는 모듈 로드 시점에 평가되므로 DI(ConfigService)가 아니라 process.env를 직접 읽는다.
// (docker-compose의 env_file/environment는 Node 프로세스 시작 전에 이미 주입돼 있어 문제 없다)
function gatewayCorsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) {
  // Origin이 없는 비브라우저 클라이언트는 JWT 인증이 별도로 필수이므로 허용한다.
  if (!origin) return callback(null, true);
  try {
    const allowed = resolveCorsOrigins(
      process.env.CORS_ORIGIN,
      process.env.NODE_ENV === 'production',
    );
    callback(null, allowed.includes(origin));
  } catch (error) {
    callback(error instanceof Error ? error : new Error('CORS 설정 오류'));
  }
}

// 소켓에 인증된 사용자 정보를 붙여둔다(핸드셰이크에서 검증한 값).
interface AuthedSocket extends Socket {
  data: { userId: string; role: string };
}

/**
 * 채점 실시간 업데이트 WebSocket.
 *
 * 보안: 연결 시점에 반드시 JWT 핸드셰이크를 통과해야 한다.
 *  - 클라이언트는 socket.io handshake의 auth.token(또는 Authorization 헤더)으로 JWT를 보낸다.
 *  - 토큰이 없거나 위조/만료됐거나 계정이 정지됐으면 연결을 즉시 끊는다.
 *  - join(submissionId)은 "그 제출이 내 것이거나 내가 관리자일 때만" 허용한다.
 *    (예전엔 아무나 임의의 submissionId room에 들어가 남의 채점 결과/에러 메시지를 훔쳐볼 수 있었다)
 */
@WebSocketGateway({ cors: { origin: gatewayCorsOrigin, credentials: true } })
export class SubmissionGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(SubmissionGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    // 인증 핸드셰이크: 연결이 "수립되기 전"에 미들웨어에서 JWT를 검증한다.
    // 이렇게 해야 handleConnection이 실행될 시점엔 이미 인증이 끝나 있어서,
    // 클라이언트가 연결 직후 보내는 join 이벤트가 유실되는 레이스가 없다.
    this.server.use(async (client, next) => {
      const auth = await this.authenticate(client as Socket);
      if (!auth) {
        next(new Error('unauthorized'));
        return;
      }
      (client as AuthedSocket).data = auth;
      next();
    });

    const subscriber = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
    });
    subscriber.subscribe(SUBMISSION_UPDATES_CHANNEL, (err) => {
      if (err) this.logger.error(`Redis 구독 실패: ${err.message}`);
    });
    subscriber.on('message', (_channel, message) => {
      try {
        const payload = JSON.parse(message);
        this.server.to(payload.submissionId).emit('submission-update', payload);
      } catch (e) {
        this.logger.warn(`잘못된 payload 수신: ${message}`);
      }
    });
  }

  /** 소켓 핸드셰이크에서 JWT를 꺼내 검증한다. 실패하면 null. */
  private async authenticate(client: Socket): Promise<{ userId: string; role: string } | null> {
    const raw =
      (client.handshake.auth && (client.handshake.auth.token as string)) ||
      (client.handshake.headers.authorization as string | undefined);
    if (!raw) return null;
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: requireJwtSecret(this.config),
        algorithms: ['HS256'],
      });
      // 발급 이후 계정이 정지됐을 수 있으니 DB로 최신 상태 확인(HTTP JwtStrategy와 동일한 방침).
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
      if (
        !user ||
        user.banned ||
        !user.emailVerified ||
        user.mustChangePassword ||
        payload.ver !== user.authVersion
      ) return null;
      return { userId: payload.sub, role: user.role };
    } catch {
      return null;
    }
  }

  // 미들웨어에서 이미 인증을 마친 뒤에만 도달하므로, 여기서는 리스너를 동기적으로 붙인다.
  handleConnection(client: Socket) {
    const auth = (client as AuthedSocket).data;

    client.on('join', async (submissionId: string) => {
      if (typeof submissionId !== 'string' || !submissionId) return;
      const allowed = await this.canAccessSubmission(auth, submissionId);
      if (!allowed) {
        client.emit('forbidden', { submissionId });
        return;
      }
      client.join(submissionId);
    });

    // 소켓 하나가 앱 전체 수명 동안 재사용되며 여러 제출 페이지를 옮겨다니므로, 클라이언트가
    // 떠난 room은 명시적으로 나가야 한다(안 그러면 room 멤버십이 계속 쌓여서 오래 켜둔
    // 서버일수록 소켓 어댑터 메모리를 갉아먹는다).
    client.on('leave', (submissionId: string) => {
      if (typeof submissionId === 'string') client.leave(submissionId);
    });
  }

  /** 이 제출을 실시간 구독할 자격이 있는가: 본인 제출이거나 관리자면 허용. */
  private async canAccessSubmission(
    auth: { userId: string; role: string },
    submissionId: string,
  ): Promise<boolean> {
    if (auth.role === 'ADMIN') return true;
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { userId: true },
    });
    return !!submission && submission.userId === auth.userId;
  }
}
