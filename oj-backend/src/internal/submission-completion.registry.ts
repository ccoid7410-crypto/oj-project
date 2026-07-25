import { Injectable } from '@nestjs/common';

type Waiter = { resolve: (status: string) => void; timer: NodeJS.Timeout };

/**
 * "이 제출의 채점이 끝나면 알려줘"를 기다리는 곳.
 *
 * 예전엔 problems.service의 문제 검증이 DB를 500ms마다 30초간 폴링하면서 HTTP 요청을
 * 붙잡고 있었다. 이제 채점 결과 수집이 같은 API 프로세스 안에서 일어나므로, 폴링 대신
 * 이벤트로 깨울 수 있다.
 *
 * 주의: 이건 프로세스 로컬 메모리다. API를 2개 이상 띄우게 되면 결과를 수집한 인스턴스와
 * 기다리는 인스턴스가 다를 수 있으므로, 그때는 Redis pub/sub으로 바꿔야 한다.
 * (지금은 단일 인스턴스라 이 구조가 가장 단순하고 정확하다.)
 */
@Injectable()
export class SubmissionCompletionRegistry {
  private readonly waiters = new Map<string, Set<Waiter>>();

  /**
   * 채점이 끝날 때까지 기다린다. 타임아웃이면 null.
   * 반드시 기다리려는 작업을 큐에 넣기 **전에** 호출해야 결과를 놓치지 않는다.
   */
  wait(submissionId: string, timeoutMs: number): Promise<string | null> {
    return new Promise((resolve) => {
      const waiter: Waiter = {
        resolve,
        timer: setTimeout(() => {
          this.remove(submissionId, waiter);
          resolve(null);
        }, timeoutMs),
      };
      const set = this.waiters.get(submissionId) ?? new Set<Waiter>();
      set.add(waiter);
      this.waiters.set(submissionId, set);
    });
  }

  /** 채점 결과가 저장된 직후 호출한다. 기다리는 사람이 없으면 아무 일도 안 한다. */
  complete(submissionId: string, status: string): void {
    const set = this.waiters.get(submissionId);
    if (!set) return;
    this.waiters.delete(submissionId);
    for (const waiter of set) {
      clearTimeout(waiter.timer);
      waiter.resolve(status);
    }
  }

  private remove(submissionId: string, waiter: Waiter): void {
    const set = this.waiters.get(submissionId);
    if (!set) return;
    set.delete(waiter);
    if (set.size === 0) this.waiters.delete(submissionId);
  }
}
