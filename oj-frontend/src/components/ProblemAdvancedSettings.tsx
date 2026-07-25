import type { Language, ProblemType, ScoringMode } from '../api/types';
import { LANGUAGE_OPTIONS } from '../lib/languages';

const COMPILED_LANGUAGES: Language[] = ['C', 'CPP', 'JAVA', 'GO'];

interface Props {
  problemType: ProblemType;
  onProblemTypeChange: (value: ProblemType) => void;
  scoringMode: ScoringMode;
  onScoringModeChange: (value: ScoringMode) => void;
  maxScore: number;
  onMaxScoreChange: (value: number) => void;
  isPractice: boolean;
  onPracticeChange: (value: boolean) => void;
  allowedLanguages: Language[];
  onAllowedLanguagesChange: (value: Language[]) => void;
  compileOptions: Partial<Record<Language, string[]>>;
  onCompileOptionsChange: (value: Partial<Record<Language, string[]>>) => void;
  inputClass: string;
}

export function ProblemAdvancedSettings(props: Props) {
  const allLanguages = props.allowedLanguages.length === 0;

  function toggleLanguage(language: Language) {
    const current = allLanguages ? LANGUAGE_OPTIONS.map((option) => option.value) : props.allowedLanguages;
    const next = current.includes(language)
      ? current.filter((item) => item !== language)
      : [...current, language];
    props.onAllowedLanguagesChange(
      next.length === LANGUAGE_OPTIONS.length ? [] : next,
    );
  }

  function setCompileOptions(language: Language, raw: string) {
    const args = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const next = { ...props.compileOptions };
    if (args.length > 0) next[language] = args;
    else delete next[language];
    props.onCompileOptionsChange(next);
  }

  return (
    <div className="rounded border border-ink-500 bg-ink-700 p-4">
      <h2 className="text-sm font-bold">채점 방식</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs">
          문제 유형
          <select
            value={props.problemType}
            onChange={(event) => props.onProblemTypeChange(event.target.value as ProblemType)}
            className={props.inputClass}
          >
            <option value="STANDARD">일반 (정답 비교)</option>
            <option value="SCORING">정확도/최적화</option>
            <option value="INTERACTIVE">인터랙티브</option>
          </select>
        </label>
        {props.problemType === 'SCORING' && (
          <>
            <label className="flex flex-col gap-1 text-xs">
              점수 기준
              <select
                value={props.scoringMode}
                onChange={(event) => props.onScoringModeChange(event.target.value as ScoringMode)}
                className={props.inputClass}
              >
                <option value="TARGET">목표값에 가까울수록</option>
                <option value="MAXIMIZE">클수록 좋음</option>
                <option value="MINIMIZE">작을수록 좋음</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              만점
              <input
                type="number"
                min={0.0001}
                step="any"
                value={props.maxScore}
                onChange={(event) => props.onMaxScoreChange(Number(event.target.value))}
                className={props.inputClass}
              />
            </label>
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-fg-muted">
        {props.problemType === 'SCORING'
          ? '각 출력의 첫 숫자를 기준값과 비교해 테스트별 점수를 합산합니다.'
          : props.problemType === 'INTERACTIVE'
            ? '각 테스트의 입력/출력 줄 수가 같아야 하며, 채점기는 요청 한 줄마다 응답 한 줄을 기다립니다.'
            : '기존 방식대로 줄 끝 공백과 마지막 개행을 제외하고 출력을 비교합니다.'}
      </p>

      <label className="mt-4 flex items-center gap-2 text-xs text-fg-muted">
        <input
          type="checkbox"
          checked={props.isPractice}
          onChange={(event) => props.onPracticeChange(event.target.checked)}
        />
        연습 문제 (정답 제출을 레이팅에 반영하지 않음)
      </label>

      <div className="mt-4">
        <p className="text-xs font-bold">허용 언어</p>
        <label className="mt-2 flex items-center gap-2 text-xs text-fg-muted">
          <input
            type="checkbox"
            checked={allLanguages}
            onChange={(event) =>
              props.onAllowedLanguagesChange(
                event.target.checked ? [] : LANGUAGE_OPTIONS.map((option) => option.value),
              )
            }
          />
          모든 언어 허용
        </label>
        <div className="mt-2 flex flex-wrap gap-3">
          {LANGUAGE_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={allLanguages || props.allowedLanguages.includes(option.value)}
                onChange={() => toggleLanguage(option.value)}
                disabled={allLanguages}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-bold">문제별 컴파일 옵션</summary>
        <p className="mt-1 text-xs text-fg-muted">
          전역 컴파일 명령에 추가할 인자를 한 줄에 하나씩 입력합니다. 인터프리터 언어는 지원하지 않습니다.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {COMPILED_LANGUAGES.map((language) => (
            <label key={language} className="flex flex-col gap-1 text-xs">
              {LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ?? language}
              <textarea
                rows={3}
                value={(props.compileOptions[language] ?? []).join('\n')}
                onChange={(event) => setCompileOptions(language, event.target.value)}
                placeholder={'예: -O0\n-std=c++20'}
                className={`${props.inputClass} font-mono`}
              />
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
