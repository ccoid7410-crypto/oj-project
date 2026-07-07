import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

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

  const app = await NestFactory.create(AppModule);

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
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
