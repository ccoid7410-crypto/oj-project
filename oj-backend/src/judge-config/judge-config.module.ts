import { Module } from '@nestjs/common';
import { JudgeConfigService } from './judge-config.service';
import { RunnerFactory } from '../judge/runners/runner.factory';

/**
 * 채점 설정(컴파일/실행 커맨드) 공유 모듈.
 * API 서버(어드민 설정 화면)와 채점 워커(실제 컴파일)가 모두 사용한다.
 */
@Module({
  providers: [JudgeConfigService, RunnerFactory],
  exports: [JudgeConfigService, RunnerFactory],
})
export class JudgeConfigModule {}
