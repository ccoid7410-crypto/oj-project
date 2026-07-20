import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RunnerFactory } from '../judge/runners/runner.factory';
import { LanguageRunnerConfig } from '../judge/runners/runner.types';

/** DB에서 오버라이드 가능한 언어별 설정(컴파일/실행 커맨드). */
export type LanguageOverride = Partial<
  Pick<LanguageRunnerConfig, 'compileCmd' | 'runCmd' | 'compileImage' | 'runImage'>
>;
export type JudgeConfigMap = Record<string, LanguageOverride>;

const ALLOWED_OVERRIDE_KEYS = new Set(['compileCmd', 'runCmd', 'compileImage', 'runImage']);
const IMAGE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._/:@-]{0,199}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

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

  private normalizeCommand(value: unknown, field: string, allowNull: boolean): string[] | null {
    if (value === null && allowNull) return null;
    if (!Array.isArray(value) || value.length < 1 || value.length > 64) {
      throw new BadRequestException(`${field}는 1~64개 문자열로 된 배열이어야 합니다.`);
    }
    if (value.some((arg) => typeof arg !== 'string' || arg.length > 512 || arg.includes('\0'))) {
      throw new BadRequestException(`${field} 인자는 각각 512자 이하의 NUL 없는 문자열이어야 합니다.`);
    }
    return value as string[];
  }

  private normalizeConfig(value: unknown, strict: boolean): JudgeConfigMap {
    if (!isRecord(value)) {
      if (strict) throw new BadRequestException('채점 설정은 언어별 객체여야 합니다.');
      return {};
    }

    const knownLanguages = new Set(Object.keys(this.runnerFactory.getAll()));
    const result: JudgeConfigMap = Object.create(null);
    for (const [language, rawOverride] of Object.entries(value)) {
      if (!knownLanguages.has(language) || !isRecord(rawOverride)) {
        if (strict) throw new BadRequestException(`지원하지 않는 채점 설정 언어/형식입니다: ${language}`);
        continue;
      }
      const unknownKeys = Object.keys(rawOverride).filter((key) => !ALLOWED_OVERRIDE_KEYS.has(key));
      if (unknownKeys.length > 0) {
        if (strict) {
          throw new BadRequestException(`${language} 설정에 허용되지 않는 키가 있습니다: ${unknownKeys.join(', ')}`);
        }
      }

      const normalized: LanguageOverride = {};
      try {
        if ('compileCmd' in rawOverride) {
          normalized.compileCmd = this.normalizeCommand(rawOverride.compileCmd, `${language}.compileCmd`, true);
        }
        if ('runCmd' in rawOverride) {
          normalized.runCmd = this.normalizeCommand(rawOverride.runCmd, `${language}.runCmd`, false)!;
        }
        for (const field of ['compileImage', 'runImage'] as const) {
          if (!(field in rawOverride)) continue;
          const image = rawOverride[field];
          if (typeof image !== 'string' || !IMAGE_REFERENCE.test(image)) {
            throw new BadRequestException(`${language}.${field} 이미지 참조 형식이 올바르지 않습니다.`);
          }
          normalized[field] = image;
        }
      } catch (error) {
        if (strict) throw error;
        continue;
      }
      result[language] = normalized;
    }
    return result;
  }

  private async loadRaw(): Promise<JudgeConfigMap> {
    const row = await this.prisma.judgeConfig.findUnique({ where: { id: 1 } });
    // 기존 DB에 과거 버전의 임의 키(fileName/binds 등)가 남아 있어도 워커 실행 설정에는 절대 섞지 않는다.
    return this.normalizeConfig(row?.config ?? {}, false);
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
    const validated = this.normalizeConfig(partial, true);
    const merged: JudgeConfigMap = { ...current };
    for (const [lang, ov] of Object.entries(validated)) {
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
