import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import { createServer } from 'http';
import { JudgeModule } from './judge/judge.module';
import { createPublicProxy } from './proxy/public-proxy';
import { requireServiceToken } from './common/service-token';

/**
 * 인터체인저는 **두 개의 리스너**로 뜬다.
 *
 *  :4000 공개  - nginx에서 오는 프론트엔드 트래픽을 백엔드로 스트리밍 전달
 *  :4001 내부  - 채점 VM 전용. 서비스 토큰이 있어야 하고 nginx는 이 포트를 모른다.
 *
 * 한 리스너에 둘을 합치지 않는 이유: nginx가 `/api/` 접두사를 벗겨서 넘기기 때문에,
 * 경로 규칙 하나만 어긋나도 브라우저가 내부 엔드포인트에 닿을 수 있다.
 * 포트를 물리적으로 나누면 그런 실수 자체가 불가능해진다.
 */
async function bootstrap() {
  const logger = new Logger('Interchanger');
  const env = { get: (key: string) => process.env[key] };

  // 약한 토큰으로 조용히 뜨느니 아예 안 뜨는 게 낫다.
  requireServiceToken(env, 'JUDGE_SERVICE_TOKEN');
  requireServiceToken(env, 'INTERNAL_API_TOKEN');

  await startInternalListener(logger);
  startPublicListener(logger);
}

async function startInternalListener(logger: Logger): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(JudgeModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.enableShutdownHooks();
  // 이 리스너 앞에는 프록시가 없다. XFF를 믿으면 호출자가 IP를 마음대로 위조한다.
  app.set('trust proxy', false);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  // 채점 결과에는 테스트케이스별 출력이 여러 개 담긴다.
  app.use(express.json({ limit: '20mb' }));

  const port = Number(process.env.INTERNAL_PORT ?? 4001);
  await app.listen(port);
  logger.log(`내부 리스너(채점 VM 전용) ${port} 대기 중`);
}

function startPublicListener(logger: Logger): void {
  const target = process.env.API_PUBLIC_URL ?? 'http://api:3000';
  const maxBodyBytes = Number(process.env.MAX_BODY_BYTES ?? 20 * 1024 * 1024);
  const proxy = createPublicProxy({ target, maxBodyBytes });

  // Nest를 쓰지 않는다: 여기서 하는 일은 라우팅이 아니라 "그대로 흘려보내기"뿐이고,
  // 프레임워크를 끼우면 바디가 한 번 더 버퍼링될 위험만 생긴다.
  const app = express();
  app.disable('x-powered-by');
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });
  app.use((req, res) => proxy.handle(req, res));

  const server = createServer(app);
  proxy.attachUpgrade(server); // socket.io 업그레이드 전달

  const port = Number(process.env.PUBLIC_PORT ?? 4000);
  server.listen(port, () => logger.log(`공개 리스너 ${port} 대기 중 (→ ${target})`));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled promise rejection', reason);
});

process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('Uncaught exception', err);
  process.exit(1);
});
