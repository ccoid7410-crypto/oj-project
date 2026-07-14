import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProblemsModule } from './problems/problems.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { GatewayModule } from './gateway/gateway.module';
import { AdminModule } from './admin/admin.module';
import { ApiKeyModule } from './apikeys/apikey.module';
import { ContestsModule } from './contests/contests.module';
import { GroupsModule } from './groups/groups.module';
import { ClassesModule } from './classes/classes.module';
import { BannerModule } from './banner/banner.module';

/**
 * API 서버 모듈. 채점 워커(JudgeModule)는 보안/스케일링 상 별도 프로세스로 분리해서
 * src/judge-worker.module.ts + src/main-worker.ts 로 독립 배포한다.
 * (API 서버 컨테이너에는 docker.sock을 마운트하지 않는다)
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 기본 요청 제한(전역). 로그인/회원가입/제출처럼 남용 위험이 큰 엔드포인트는
    // 각 컨트롤러에서 @Throttle로 더 빡빡하게 덮어쓴다.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
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
    AuthModule,
    UsersModule,
    ProblemsModule,
    SubmissionsModule,
    GatewayModule,
    AdminModule,
    ApiKeyModule,
    ContestsModule,
    GroupsModule,
    ClassesModule,
    BannerModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
