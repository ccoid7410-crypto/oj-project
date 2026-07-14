import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { UPLOADS_ROOT } from './banner/banner.service';

function resolveCorsOrigins(): string[] | boolean {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) {
    // 운영에서 CORS_ORIGIN을 안 정해두면 전체 허용으로 새는 사고가 흔하다.
    // 프로덕션에서는 명시적으로 도메인을 지정하도록 강제하고, 개발 편의를 위해 로컬만 기본 허용한다.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('운영 환경에서는 CORS_ORIGIN 환경변수를 반드시 설정해야 합니다 (콤마로 구분).');
    }
    return ['http://localhost:5173'];
  }
  return raw.split(',').map((o) => o.trim());
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // JWT_SECRET이 없으면 코드 어딘가의 기본값(dev_secret_change_me)으로 조용히 넘어가는 게
  // 가장 위험한 실패 모드다 - 운영에서는 아예 기동을 막는다.
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('운영 환경에서는 JWT_SECRET 환경변수를 반드시 설정해야 합니다.');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();

  // 배너 업로드 대상 디렉토리는 볼륨 마운트 시 컨테이너 재생성 때마다 비어있을 수 있으니
  // 멀터가 파일을 쓰기 전에 항상 존재를 보장해둔다.
  mkdirSync(`${UPLOADS_ROOT}/banner`, { recursive: true });
  // 업로드된 배너 이미지는 /api/uploads/... 로 nginx가 그대로 프록시해 서빙한다(정적 파일이라
  // 인증 불필요, helmet의 crossOriginResourcePolicy: same-site 설정과도 충돌 없음).
  app.useStaticAssets(UPLOADS_ROOT, { prefix: '/uploads' });

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

  // Express 기본 바디 파서 한도(json 기준 100kb)가 너무 작아서, 스트레스 테스트용으로
  // 큰 입력을 넣는 테스트케이스나 대량 계정 생성 요청이 "request entity too large"로 막혔다.
  // 문제 하나에 들어갈 테스트케이스 총량 기준으로 여유 있게 잡는다.
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ limit: '20mb', extended: true }));

  const corsOrigins = resolveCorsOrigins();
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
