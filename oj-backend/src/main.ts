import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { InternalApiModule } from './internal/internal-api.module';
import { UPLOADS_ROOT } from './banner/banner.service';
import {
  requireFrontendOrigin,
  requireJwtSecret,
  requireSecureDatabaseUrl,
  resolveCorsOrigins,
} from './common/security-config';
import { requireServiceToken } from './common/service-token';

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

  // 현재 모든 외부 트래픽은 프론트 nginx(단일 홉)를 거쳐 들어온다. trust proxy를 켜야
  // req.ip가 nginx가 붙여준 X-Forwarded-For의 실제 클라이언트 IP가 되어, rate limit이
  // 클라이언트별로 걸린다. 안 켜면 모두가 nginx 컨테이너 IP 하나로 묶여, 공격자 한 명이
  // 로그인 5회/분 같은 제한을 전체 사용자 대상으로 소진시킬 수 있다.
  // 6단계에서 인터체인저 공개 프록시까지 넣으면 두 홉이 되므로 TRUST_PROXY_HOPS=2로 함께
  // 바꿔야 한다. 허용 범위를 1~2로 제한해 설정 실수로 임의의 외부 XFF를 신뢰하지 않게 한다.
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS) === 2 ? 2 : 1;
  app.set('trust proxy', trustProxyHops);

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

  await startInternalListener(logger);
}

/**
 * 인터체인저 전용 내부 리스너. 공개 앱과 라우트를 공유하지 않는 별도 Nest 앱이다.
 * (이유는 InternalApiModule 주석 참고 - nginx의 /api 접두사 제거와 충돌하지 않게 하기 위함)
 *
 * INTERNAL_API_TOKEN이 없으면 아예 띄우지 않는다. 인터체인저를 아직 안 쓰는 배포에서
 * 인증 없는 내부 엔드포인트가 조용히 열려 있는 것보다 낫다.
 */
async function startInternalListener(logger: Logger): Promise<void> {
  if (!process.env.INTERNAL_API_TOKEN) {
    logger.warn('INTERNAL_API_TOKEN이 없어 내부 리스너를 띄우지 않습니다.');
    return;
  }
  requireServiceToken(
    { get: (key: string) => process.env[key] },
    'INTERNAL_API_TOKEN',
  );

  const internalApp = await NestFactory.create<NestExpressApplication>(
    InternalApiModule,
    {
      logger: ['error', 'warn'],
    },
  );
  internalApp.enableShutdownHooks();
  // 이 리스너 앞에는 프록시가 없다. XFF를 신뢰하면 호출자가 자기 IP를 마음대로 위조할 수 있다.
  internalApp.set('trust proxy', false);
  internalApp.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  // 채점 결과 페이로드(테스트케이스 출력 다수)가 기본 100kb를 넘을 수 있다.
  internalApp.use(json({ limit: '20mb' }));

  const internalPort = Number(process.env.INTERNAL_PORT ?? 3001);
  // 0.0.0.0에 붙지만 이 포트는 compose 내부망에만 존재하고 호스트로 publish하지 않는다.
  await internalApp.listen(internalPort);
  logger.log(`Internal listener listening on ${internalPort}`);
}

bootstrap().catch((err) => {
  // Nest 기동 전 실패도 컨테이너 로그에 남기고 명확하게 종료한다.
  // 예: 운영 JWT_SECRET/CORS_ORIGIN 누락, DB 연결 실패.

  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception', err);
  process.exit(1);
});
