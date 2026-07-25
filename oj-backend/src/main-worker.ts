import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { JudgeWorkerModule } from './judge-worker.module';
import { requireServiceToken } from './common/service-token';

async function bootstrap() {
  const env = { get: (key: string) => process.env[key] };

  // 이 프로세스는 DB를 모른다(DATABASE_URL 검증이 여기 있었지만 이제 필요 없다).
  // 대신 인터체인저에 붙기 위한 값들이 제대로 있는지 확인한다.
  requireServiceToken(env, 'JUDGE_SERVICE_TOKEN');
  if (!process.env.INTERCHANGER_URL) {
    throw new Error(
      'INTERCHANGER_URL을 설정해야 합니다. 채점기는 인터체인저를 통해서만 일감을 받습니다.',
    );
  }

  const logger = new Logger('JudgeWorker');
  const app = await NestFactory.createApplicationContext(JudgeWorkerModule);
  app.enableShutdownHooks();
  await app.init();
  logger.log('채점 워커가 큐를 대기 중입니다...');
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
