import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { UPLOADS_ROOT } from './banner/banner.service';
import {
  requireFrontendOrigin,
  requireJwtSecret,
  requireSecureDatabaseUrl,
  resolveCorsOrigins,
} from './common/security-config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // 개발/운영 구분 없이 약한 기본 키로 기동하지 않는다. 개발 환경도 setup.sh가 안전한 키를 만들어준다.
  requireJwtSecret({ get: (key: string) => process.env[key] });
  requireSecureDatabaseUrl(
    { get: (key: string) => process.env[key] },
    process.env.NODE_ENV === 'production',
  );
  requireFrontendOrigin(
    { get: (key: string) => process.env[key] },
    process.env.NODE_ENV === 'production',
  );

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();

  // 모든 외부 트래픽은 프론트 nginx(단일 홉)를 거쳐 들어온다. trust proxy를 켜야
  // req.ip가 nginx가 붙여준 X-Forwarded-For의 실제 클라이언트 IP가 되어, rate limit이
  // 클라이언트별로 걸린다. 안 켜면 모두가 nginx 컨테이너 IP 하나로 묶여, 공격자 한 명이
  // 로그인 5회/분 같은 제한을 전체 사용자 대상으로 소진시킬 수 있다.
  // (API를 127.0.0.1로 잠가서 nginx 외의 경로로는 못 들어오므로 X-Forwarded-For를 신뢰해도 안전)
  app.set('trust proxy', 1);

  // 보안 헤더. 이 서버는 JSON API + socket.io만 응답하므로(HTML 페이지는 nginx가 서빙)
  // CSP는 프론트 nginx 쪽에서 걸고, 여기서는 API 응답에 불필요한 CSP로 오작동하지 않게 끈다.
  // crossOriginResourcePolicy도 same-origin nginx 프록시 구조라 same-site로 완화한다.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  // 정적 업로드 응답도 위의 helmet/nosniff 헤더를 반드시 거치게 한다. 정적 미들웨어를 helmet보다
  // 먼저 등록하면 MIME을 위장한 업로드가 브라우저에서 HTML로 해석될 여지가 생긴다.
  mkdirSync(`${UPLOADS_ROOT}/banner`, { recursive: true });
  app.useStaticAssets(UPLOADS_ROOT, { prefix: '/uploads' });

  // Express 기본 바디 파서 한도(json 기준 100kb)가 너무 작아서, 스트레스 테스트용으로
  // 큰 입력을 넣는 테스트케이스나 대량 계정 생성 요청이 "request entity too large"로 막혔다.
  // 문제 하나에 들어갈 테스트케이스 총량 기준으로 여유 있게 잡는다.
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ limit: '20mb', extended: true }));

  const corsOrigins = resolveCorsOrigins(
    process.env.CORS_ORIGIN,
    process.env.NODE_ENV === 'production',
  );
  app.enableCors({ origin: corsOrigins, credentials: true });
  logger.log(`CORS allowed origins: ${JSON.stringify(corsOrigins)}`);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  const server = await app.listen(port);
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 120_000;
  logger.log(`API server listening on ${port}`);
}

bootstrap().catch((err) => {
  // Nest 기동 전 실패도 컨테이너 로그에 남기고 명확하게 종료한다.
  // 예: 운영 JWT_SECRET/CORS_ORIGIN 누락, DB 연결 실패.
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
