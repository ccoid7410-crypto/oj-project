import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { JudgeWorkerModule } from './judge-worker.module';
import { requireSecureDatabaseUrl } from './common/security-config';

async function bootstrap() {
  requireSecureDatabaseUrl(
    { get: (key: string) => process.env[key] },
    process.env.NODE_ENV === 'production',
  );
  const logger = new Logger('JudgeWorker');
  const app = await NestFactory.createApplicationContext(JudgeWorkerModule);
  app.enableShutdownHooks();
  await app.init();
  logger.log('채점 워커가 큐를 대기 중입니다...');
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
