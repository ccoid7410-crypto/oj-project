import {
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { SUBMISSION_UPDATES_CHANNEL } from '../judge/judge.processor';

// 데코레이터 인자는 모듈 로드 시점에 평가되므로 DI(ConfigService)가 아니라 process.env를 직접 읽는다.
// (docker-compose의 env_file/environment는 Node 프로세스 시작 전에 이미 주입돼 있어 문제 없다)
function resolveGatewayCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return ['http://localhost:5173'];
  return raw.split(',').map((o) => o.trim());
}

/**
 * 클라이언트는 소켓 연결 후 join 이벤트로 submissionId room에 들어가고,
 * 채점 워커(별도 프로세스)가 Redis에 publish한 업데이트를 이 게이트웨이가 구독해서
 * 해당 room에 그대로 emit 해준다.
 *
 * 클라이언트 사용 예:
 *   const socket = io(url);
 *   socket.emit('join', submissionId);
 *   socket.on('submission-update', (payload) => { ... });
 */
@WebSocketGateway({ cors: { origin: resolveGatewayCorsOrigins(), credentials: true } })
export class SubmissionGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(SubmissionGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly config: ConfigService) {}

  afterInit() {
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

  handleConnection(client: Socket) {
    client.on('join', (submissionId: string) => {
      client.join(submissionId);
    });
  }
}
