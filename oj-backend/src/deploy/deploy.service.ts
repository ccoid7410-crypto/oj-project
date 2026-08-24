import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const execFileAsync = promisify(execFile);

const MAX_OUTPUT_CHARS = 8000;
const STEP_TIMEOUT_MS = 10 * 60 * 1000; // 빌드가 저사양 호스트에서 오래 걸릴 수 있어 넉넉히 잡음
// 이 시간이 지나도 "실행 중"이면 죽은 기록으로 본다(컨테이너가 중간에 죽어 끝을 못 적은 경우).
const STALE_RUN_MS = 35 * 60 * 1000;

export interface DeployStepResult {
  step: string;
  ok: boolean;
  output: string;
}

export interface DeployStatus {
  /** 지금 배포가 돌고 있는지. */
  running: boolean;
  /** 끝난 배포의 성패. 아직 안 끝났거나 기록이 없으면 null. */
  ok: boolean | null;
  steps: DeployStepResult[];
  startedAt: string | null;
  finishedAt: string | null;
}

const IDLE: DeployStatus = {
  running: false,
  ok: null,
  steps: [],
  startedAt: null,
  finishedAt: null,
};

function truncate(text: string): string {
  return text.length > MAX_OUTPUT_CHARS
    ? text.slice(0, MAX_OUTPUT_CHARS) + '\n...(truncated)'
    : text;
}

/**
 * 배포 트리거의 유일한 로직. **요청 바디의 어떤 값도 여기로 흘러들어오지 않는다** -
 * 실행되는 커맨드와 인자는 전부 이 파일 안에 고정 문자열로 박혀 있다(셸 문자열 조합 없음,
 * execFile만 사용). 그래서 이 엔드포인트를 호출할 수 있는 사람이 할 수 있는 일은
 * "정확히 이 세 단계를 순서대로 실행한다" 하나뿐이고, 임의 명령 실행 경로가 없다.
 *
 * 배포는 요청을 붙잡고 기다리지 않고 백그라운드로 돌린다. 마지막 단계인
 * `docker compose up -d`가 이 컨테이너 자신도 새로 만들기 때문에, 응답을 기다리면
 * 배포가 성공해도 연결이 끊겨 실패처럼 보이기 때문이다. 대신 진행 상황을 저장소 안의
 * 상태 파일에 적어두고(마운트라 재시작해도 남는다) 호출한 쪽이 조회해 가게 한다.
 */
@Injectable()
export class DeployService {
  private readonly logger = new Logger(DeployService.name);
  private readonly repoDir = process.env.DEPLOY_REPO_DIR ?? '/repo';
  private readonly statePath = join(this.repoDir, '.deploy-state.json');

  /** 이미 돌고 있으면 false를 돌려주고 아무것도 새로 시작하지 않는다. */
  async start(): Promise<boolean> {
    const current = await this.status();
    if (current.running) return false;

    const startedAt = new Date().toISOString();
    await this.write({ ...IDLE, running: true, startedAt });
    // 응답을 먼저 보내고 뒤에서 진행한다.
    void this.run(startedAt);
    return true;
  }

  async status(): Promise<DeployStatus> {
    let saved: DeployStatus;
    try {
      saved = JSON.parse(await readFile(this.statePath, 'utf8')) as DeployStatus;
    } catch {
      return IDLE;
    }
    if (!saved.running) return saved;

    // 배포 도중 컨테이너가 죽으면 running이 true로 남는다. 너무 오래된 건 실패로 본다.
    const startedMs = saved.startedAt ? Date.parse(saved.startedAt) : 0;
    if (startedMs && Date.now() - startedMs > STALE_RUN_MS) {
      return { ...saved, running: false, ok: false };
    }
    return saved;
  }

  private async run(startedAt: string) {
    const steps: DeployStepResult[] = [];

    const record = async (step: string, result: { ok: boolean; output: string }) => {
      steps.push({ step, ...result });
      await this.write({ running: true, ok: null, steps, startedAt, finishedAt: null });
      return result.ok;
    };

    const finish = async (ok: boolean) => {
      await this.write({
        running: false,
        ok,
        steps,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      this.logger.log(`배포 ${ok ? '성공' : '실패'}`);
    };

    try {
      const gitPull = await this.exec('git', [
        '-C',
        this.repoDir,
        'pull',
        '--ff-only',
        'origin',
        'main',
      ]);
      if (!(await record('git pull', gitPull))) return finish(false);

      const build = await this.exec('docker', ['compose', 'build'], this.repoDir);
      if (!(await record('docker compose build', build))) return finish(false);

      // 이 배포 에이전트 자신은 재생성 대상에서 뺀다.
      // docker compose up -d가 에이전트 컨테이너를 다시 만들면 그 순간 이 프로세스가 죽어서
      // up -d가 중간에 끊긴다(그래서 일부 컨테이너만 뜨고 배포가 실패로 남았다).
      // 에이전트 코드는 거의 안 바뀌고, 바뀌더라도 다음 배포나 수동 재시작으로 반영하면 된다.
      const services = await this.exec(
        'docker',
        ['compose', 'config', '--services'],
        this.repoDir,
      );
      if (!(await record('대상 서비스 확인', services))) return finish(false);
      const targets = services.output
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s && s !== 'deploy-agent');

      const up = await this.exec(
        'docker',
        ['compose', 'up', '-d', ...targets],
        this.repoDir,
      );
      await record('docker compose up -d', up);
      return finish(up.ok);
    } catch (err) {
      this.logger.error(`배포 중 예외: ${String(err)}`);
      steps.push({ step: '예외', ok: false, output: String(err) });
      return finish(false);
    }
  }

  private async write(status: DeployStatus) {
    try {
      await writeFile(this.statePath, JSON.stringify(status), 'utf8');
    } catch (err) {
      this.logger.error(`배포 상태 저장 실패: ${String(err)}`);
    }
  }

  private async exec(
    cmd: string,
    args: string[],
    cwd?: string,
  ): Promise<{ ok: boolean; output: string }> {
    this.logger.log(`실행: ${cmd} ${args.join(' ')}`);
    try {
      const { stdout, stderr } = await execFileAsync(cmd, args, {
        cwd,
        timeout: STEP_TIMEOUT_MS,
        maxBuffer: 20 * 1024 * 1024,
      });
      return { ok: true, output: truncate(stdout + stderr) };
    } catch (err) {
      const anyErr = err as { stdout?: string; stderr?: string; message?: string };
      const output =
        `${anyErr.stdout ?? ''}${anyErr.stderr ?? ''}` || String(anyErr.message ?? err);
      this.logger.error(`실패: ${cmd} ${args.join(' ')}\n${output}`);
      return { ok: false, output: truncate(output) };
    }
  }
}
