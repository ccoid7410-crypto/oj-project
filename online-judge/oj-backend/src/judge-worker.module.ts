import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { JudgeModule } from './judge/judge.module';

/**
 * 채점 워커 전용 부트스트랩 모듈.
 * 이 프로세스만 docker.sock에 접근할 수 있어야 하며, HTTP 포트를 열 필요는 없다.
 * (API 서버와 완전히 분리해서 배포 → 코드 실행 관련 보안 사고가 API 서버로 번지지 않게 격리)
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    PrismaModule,
    JudgeModule,
  ],
})
export class JudgeWorkerModule {}
