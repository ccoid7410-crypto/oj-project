import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiClientService } from './api-client.service';
import { JudgeController } from './judge.controller';
import { JudgeTokenGuard } from './judge-token.guard';
import { LeaseService } from './lease.service';

/** 채점 VM 전용 내부 리스너(:4001)의 루트 모듈. */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [JudgeController],
  providers: [LeaseService, ApiClientService, JudgeTokenGuard],
})
export class JudgeModule {}
