import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { JudgeWorkerModule } from './judge-worker.module';

async function bootstrap() {
  const logger = new Logger('JudgeWorker');
  const app = await NestFactory.createApplicationContext(JudgeWorkerModule);
  await app.init();
  logger.log('채점 워커가 큐를 대기 중입니다...');
}

bootstrap();
