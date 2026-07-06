import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RunnerFactory } from '../judge/runners/runner.factory';
import { LanguageRunnerConfig } from '../judge/runners/runner.types';

/** DB에서 오버라이드 가능한 언어별 설정(컴파일/실행 커맨드). */
export type LanguageOverride = Partial<
  Pick<LanguageRunnerConfig, 'compileCmd' | 'runCmd' | 'compileImage' | 'runImage'>
>;
export type JudgeConfigMap = Record<string, LanguageOverride>;

/**
 * 채점기 컴파일/실행 설정을 DB(judge_config 단일 행)에서 읽어 기본값 위에 덮어쓴다.
 * 어드민이 UI에서 컴파일 플래그/커맨드를 바꾸면 워커가 다음 채점부터 반영한다.
 */
@Injectable()
export class JudgeConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runnerFactory: RunnerFactory,
  ) {}

  private async loadRaw(): Promise<JudgeConfigMap> {
    const row = await this.prisma.judgeConfig.findUnique({ where: { id: 1 } });
    return (row?.config as JudgeConfigMap) ?? {};
  }

  /** 어드민 표시용: 언어별 (기본값 + 오버라이드) 병합 결과 전체. */
  async getEffective() {
    const overrides = await this.loadRaw();
    const defaults = this.runnerFactory.getAll();
    const result: Record<string, LanguageRunnerConfig> = {};
    for (const [lang, base] of Object.entries(defaults)) {
      result[lang] = { ...base, ...(overrides[lang] ?? {}) };
    }
    return result;
  }

  /** 채점 워커용: 특정 언어의 병합된 실행 설정. */
  async getRunnerConfig(language: string): Promise<LanguageRunnerConfig> {
    const base = this.runnerFactory.getConfig(language);
    const overrides = await this.loadRaw();
    return { ...base, ...(overrides[language] ?? {}) };
  }

  /** 어드민 수정: 언어별 오버라이드를 병합 저장. 빈 오버라이드 키는 제거해 기본값으로 되돌린다. */
  async update(partial: JudgeConfigMap, updatedById?: string) {
    const current = await this.loadRaw();
    const merged: JudgeConfigMap = { ...current };
    for (const [lang, ov] of Object.entries(partial)) {
      if (!ov || Object.keys(ov).length === 0) delete merged[lang];
      else merged[lang] = ov;
    }
    await this.prisma.judgeConfig.upsert({
      where: { id: 1 },
      create: { id: 1, config: merged as any, updatedById },
      update: { config: merged as any, updatedById },
    });
    return this.getEffective();
  }

  /** 기본값으로 전체 초기화. */
  async reset(updatedById?: string) {
    await this.prisma.judgeConfig.upsert({
      where: { id: 1 },
      create: { id: 1, config: {}, updatedById },
      update: { config: {}, updatedById },
    });
    return this.getEffective();
  }
}
