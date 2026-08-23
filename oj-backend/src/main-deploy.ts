import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DeployModule } from './deploy/deploy.module';
import { requireServiceToken } from './common/service-token';

async function bootstrap() {
  const logger = new Logger('DeployAgent');

  requireServiceToken(
    { get: (key: string) => process.env[key] },
    'DEPLOY_SERVICE_TOKEN',
  );

  const app = await NestFactory.create<NestExpressApplication>(DeployModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.enableShutdownHooks();
  // 이 리스너 앞에는 프록시가 없고 인터넷에도 노출되지 않는다(backend_net 내부 전용).
  app.set('trust proxy', false);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = Number(process.env.PORT ?? 3002);
  await app.listen(port);
  logger.log(`배포 에이전트가 ${port}에서 대기 중입니다.`);
}

bootstrap().catch((err) => {
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
