import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const MAX_OUTPUT_CHARS = 8000;
const STEP_TIMEOUT_MS = 10 * 60 * 1000; // 빌드가 저사양 호스트에서 오래 걸릴 수 있어 넉넉히 잡음

export interface DeployStepResult {
  step: string;
  ok: boolean;
  output: string;
}

export interface DeployResult {
  ok: boolean;
  steps: DeployStepResult[];
}

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
 */
@Injectable()
export class DeployService {
  private readonly logger = new Logger(DeployService.name);
  private readonly repoDir = process.env.DEPLOY_REPO_DIR ?? '/repo';

  async deploy(): Promise<DeployResult> {
    const steps: DeployStepResult[] = [];

    const gitPull = await this.run('git', [
      '-C',
      this.repoDir,
      'pull',
      '--ff-only',
      'origin',
      'main',
    ]);
    steps.push({ step: 'git pull', ...gitPull });
    if (!gitPull.ok) return { ok: false, steps };

    const build = await this.run(
      'docker',
      ['compose', 'build'],
      this.repoDir,
    );
    steps.push({ step: 'docker compose build', ...build });
    if (!build.ok) return { ok: false, steps };

    const up = await this.run(
      'docker',
      ['compose', 'up', '-d'],
      this.repoDir,
    );
    steps.push({ step: 'docker compose up -d', ...up });

    return { ok: up.ok, steps };
  }

  private async run(
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
      const output = `${anyErr.stdout ?? ''}${anyErr.stderr ?? ''}` || String(anyErr.message ?? err);
      this.logger.error(`실패: ${cmd} ${args.join(' ')}\n${output}`);
      return { ok: false, output: truncate(output) };
    }
  }
}
