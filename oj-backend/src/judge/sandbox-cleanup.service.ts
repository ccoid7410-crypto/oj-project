import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { DockerSandboxService } from './sandbox/docker-sandbox.service';

const SWEEP_INTERVAL_MS = 30 * 60_000; // 30분마다
const MAX_ORPHAN_AGE_MS = 15 * 60_000; // 15분 넘게 남아있으면 좀비로 간주

/**
 * 채점 워커를 며칠~몇 주씩 켜두면 (컨테이너 remove 실패, 프로세스가 죽는 도중의 제출 등으로)
 * 좀비 컨테이너/임시 디렉토리가 조금씩 쌓인다. 하나하나는 작아도 오래 켜둔 서버에서는
 * 누적돼서 디스크를 채우고 `docker ps`/데몬 자체를 느리게 만들어 반응성이 떨어지는
 * 원인이 된다. 30분마다 안전하게(라벨/이름 매칭된 것만) 쓸어준다.
 */
@Injectable()
export class SandboxCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SandboxCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly sandbox: DockerSandboxService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.timer.unref?.(); // 이 타이머 때문에 프로세스 종료가 막히지 않게
    // 워커가 막 재시작됐을 수도 있으니(이전 실행이 비정상 종료돼 좀비를 남겼을 가능성) 시작하자마자 한 번 돈다.
    this.sweep();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep() {
    try {
      const removed = await this.sandbox.pruneOrphanedContainers(MAX_ORPHAN_AGE_MS);
      if (removed > 0) this.logger.warn(`좀비 채점 컨테이너 ${removed}개 정리함`);
    } catch (e) {
      this.logger.warn(`컨테이너 정리 스윕 실패: ${e}`);
    }

    try {
      const removed = await this.sweepStaleTmpDirs();
      if (removed > 0) this.logger.warn(`남은 채점 임시 디렉토리 ${removed}개 정리함`);
    } catch (e) {
      this.logger.warn(`임시 디렉토리 정리 스윕 실패: ${e}`);
    }
  }

  private async sweepStaleTmpDirs(): Promise<number> {
    const tmpBase = this.config.get<string>('JUDGE_TMP_DIR', os.tmpdir());
    let entries: string[];
    try {
      entries = await fs.readdir(tmpBase);
    } catch {
      return 0; // 디렉토리가 아직 없을 수도 있음(정상)
    }

    let removed = 0;
    for (const name of entries) {
      if (!name.startsWith('judge-')) continue; // judge.processor.ts의 mkdtemp 접두사만
      const full = path.join(tmpBase, name);
      try {
        const stat = await fs.stat(full);
        if (Date.now() - stat.mtimeMs < MAX_ORPHAN_AGE_MS) continue;
        await fs.rm(full, { recursive: true, force: true });
        removed++;
      } catch (e) {
        this.logger.warn(`임시 디렉토리 정리 실패 (${full}): ${e}`);
      }
    }
    return removed;
  }
}
