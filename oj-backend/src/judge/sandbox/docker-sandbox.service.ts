import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Docker = require('dockerode');

export interface RunOptions {
  image: string;
  cmd: string[];
  binds: string[]; // e.g. ["/host/box:/box"]
  timeoutMs: number;
  memoryLimitMb: number;
  networkDisabled?: boolean;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  runtimeMs: number;
}

/**
 * 코드를 격리된 Docker 컨테이너에서 실행하는 샌드박스.
 *
 * 보안/격리 포인트:
 * - NetworkMode: none          → 외부 네트워크 접근 차단
 * - Memory / MemorySwap        → 메모리 제한 (스왑 비활성화로 메모리 제한 우회 방지)
 * - NanoCpus                   → CPU 1코어로 제한
 * - PidsLimit                  → 포크 폭탄 방지
 * - ReadonlyRootfs + tmpfs     → 컨테이너 자체 파일시스템은 읽기 전용, /box(바인드)와 /tmp(tmpfs)만 쓰기 허용
 * - User: nobody(65534)        → 컨테이너 안에서 root 권한 없이 실행 (box는 777로 열어둬서 여전히 쓰기 가능)
 * - CapDrop: ALL               → 모든 리눅스 capability 제거
 * - no-new-privileges          → setuid 바이너리 등으로 권한 상승 차단
 * - timeoutMs 초과 시 컨테이너 강제 kill
 *
 * 그래도 이 프로세스(judge-worker) 자체가 docker.sock을 통해 호스트와 사실상 동급 권한을 갖는 구조이므로,
 * 운영 배포 시에는 반드시 이 워커를 API 서버와 분리된 전용 서버/VM에 두고 네트워크도 격리해야 한다
 * (docker-compose.yml 주석 및 HANDOFF.md 체크리스트 참고).
 */
@Injectable()
export class DockerSandboxService {
  private readonly logger = new Logger(DockerSandboxService.name);
  private readonly docker: Docker;

  constructor(private readonly config: ConfigService) {
    this.docker = new Docker({ socketPath: this.config.get<string>('JUDGE_DOCKER_SOCK', '/var/run/docker.sock') });
  }

  async run(options: RunOptions): Promise<RunResult> {
    const startedAt = Date.now();
    const container = await this.docker.createContainer({
      Image: options.image,
      Cmd: options.cmd,
      Tty: false,
      OpenStdin: false,
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      User: '65534:65534', // nobody:nogroup - 컨테이너 안에서 root로 실행되지 않도록 고정
      // nobody 유저는 /etc/passwd에 홈 디렉토리가 없어 HOME이 /nonexistent(읽기전용)로 잡힌다.
      // Go 빌드 캐시처럼 $HOME 하위에 쓰려는 도구가 있어 tmpfs로 열어둔 /tmp를 홈으로 지정한다.
      Env: ['HOME=/tmp'],
      HostConfig: {
        Binds: options.binds,
        Memory: options.memoryLimitMb * 1024 * 1024,
        MemorySwap: options.memoryLimitMb * 1024 * 1024, // 스왑 비활성화
        NanoCpus: 1_000_000_000, // 1 CPU
        // Go 컴파일러가 빌드 중 병렬로 여러 워커 프로세스를 fork하므로 64는 부족했다(실측으로 확인).
        // 128 정도면 정상적인 컴파일/실행에는 충분하면서 포크 폭탄은 여전히 막을 수 있다.
        PidsLimit: 128,
        NetworkMode: options.networkDisabled === false ? undefined : 'none',
        ReadonlyRootfs: true,
        Tmpfs: { '/tmp': 'rw,size=64m,mode=1777' }, // 컴파일러가 임시파일을 쓰는 경로만 예외적으로 허용
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges:true'],
      },
    });

    let timedOut = false;
    const timeoutHandle = setTimeout(async () => {
      timedOut = true;
      try {
        await container.kill();
      } catch (e) {
        this.logger.warn(`컨테이너 kill 실패 (이미 종료됐을 수 있음): ${e}`);
      }
    }, options.timeoutMs);

    try {
      // stdin은 attach 소켓으로 넘기지 않는다: Windows의 named pipe 기반 도커 데몬에서는
      // attach stdin 하이재킹이 안정적으로 동작하지 않아 컨테이너가 무한 대기하는 문제가 있었다.
      // 대신 호출부(judge.processor)가 입력을 /box에 파일로 써두고 cmd에서 셸 리다이렉션으로 읽는다.
      const stream = await container.attach({ stream: true, stdin: false, stdout: true, stderr: true });
      await container.start();

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      container.modem.demuxStream(
        stream,
        { write: (chunk: Buffer) => stdoutChunks.push(chunk) } as any,
        { write: (chunk: Buffer) => stderrChunks.push(chunk) } as any,
      );

      const waitResult: any = await container.wait();
      clearTimeout(timeoutHandle);

      return {
        stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
        exitCode: timedOut ? null : waitResult.StatusCode,
        timedOut,
        runtimeMs: Date.now() - startedAt,
      };
    } finally {
      clearTimeout(timeoutHandle);
      try {
        await container.remove({ force: true });
      } catch (e) {
        this.logger.warn(`컨테이너 정리 실패: ${e}`);
      }
    }
  }
}
