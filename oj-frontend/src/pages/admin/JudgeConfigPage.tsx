import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import type { JudgeConfigEffective, Language, LanguageRunnerConfig } from '../../api/types';

const LANGS: Language[] = ['C', 'CPP', 'JAVA', 'PYTHON3', 'JAVASCRIPT', 'GO'];

// 편집 폼에서는 배열을 줄바꿈으로 구분한 텍스트로 다룬다.
type EditState = Record<Language, { compileCmd: string; runCmd: string; compileImage: string; runImage: string }>;

function toEditState(effective: JudgeConfigEffective): EditState {
  const out = {} as EditState;
  for (const lang of LANGS) {
    const cfg = effective[lang];
    out[lang] = {
      compileCmd: (cfg?.compileCmd ?? []).join('\n'),
      runCmd: (cfg?.runCmd ?? []).join('\n'),
      compileImage: cfg?.compileImage ?? '',
      runImage: cfg?.runImage ?? '',
    };
  }
  return out;
}

export function JudgeConfigPage() {
  const [effective, setEffective] = useState<JudgeConfigEffective | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingLang, setSavingLang] = useState<Language | null>(null);
  const [savedLang, setSavedLang] = useState<Language | null>(null);

  function load() {
    api
      .get<JudgeConfigEffective>('/admin/judge-config')
      .then((data) => {
        setEffective(data);
        setEdit(toEditState(data));
      })
      .catch(() => setError('채점 설정을 불러오지 못했습니다.'));
  }

  useEffect(load, []);

  async function saveLang(lang: Language) {
    if (!edit) return;
    setSavingLang(lang);
    setError(null);
    setSavedLang(null);
    try {
      const e = edit[lang];
      const config = {
        [lang]: {
          compileCmd: e.compileCmd.trim() ? e.compileCmd.split('\n').filter(Boolean) : null,
          runCmd: e.runCmd.split('\n').filter(Boolean),
          ...(e.compileImage ? { compileImage: e.compileImage } : {}),
          ...(e.runImage ? { runImage: e.runImage } : {}),
        },
      };
      const data = await api.put<JudgeConfigEffective>('/admin/judge-config', { config });
      setEffective(data);
      setEdit(toEditState(data));
      setSavedLang(lang);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장에 실패했습니다.');
    } finally {
      setSavingLang(null);
    }
  }

  async function resetAll() {
    setError(null);
    try {
      const data = await api.post<JudgeConfigEffective>('/admin/judge-config/reset');
      setEffective(data);
      setEdit(toEditState(data));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '초기화에 실패했습니다.');
    }
  }

  if (error && !effective) return <p className="text-sm text-[var(--color-wa)]">{error}</p>;
  if (!effective || !edit) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  const inputClass =
    'w-full rounded border border-ink-500 bg-white px-2 py-1.5 font-mono text-xs outline-none focus:border-[var(--color-brand)]';

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-fg-muted">
          언어별 컴파일/실행 커맨드를 직접 수정합니다. 컴파일 커맨드는 한 줄에 하나씩(공백 없이) 입력하세요.
        </p>
        <button
          onClick={resetAll}
          className="rounded border border-ink-500 px-3 py-1 text-xs hover:border-[var(--color-wa)] hover:text-[var(--color-wa)]"
        >
          전체 기본값으로 초기화
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-[var(--color-wa)]">{error}</p>}

      <div className="mt-4 flex flex-col gap-4">
        {LANGS.map((lang) => {
          const cfg: LanguageRunnerConfig = effective[lang];
          return (
            <div key={lang} className="rounded border border-ink-500 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{lang}</h3>
                <span className="text-xs text-fg-muted">파일: {cfg.fileName}</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs text-fg-muted">
                  compileImage
                  <input
                    value={edit[lang].compileImage}
                    onChange={(e) =>
                      setEdit((prev) => (prev ? { ...prev, [lang]: { ...prev[lang], compileImage: e.target.value } } : prev))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-fg-muted">
                  runImage
                  <input
                    value={edit[lang].runImage}
                    onChange={(e) =>
                      setEdit((prev) => (prev ? { ...prev, [lang]: { ...prev[lang], runImage: e.target.value } } : prev))
                    }
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="mt-3 flex flex-col gap-1 text-xs text-fg-muted">
                compileCmd (줄바꿈으로 구분, 비우면 컴파일 단계 생략)
                <textarea
                  rows={4}
                  value={edit[lang].compileCmd}
                  onChange={(e) =>
                    setEdit((prev) => (prev ? { ...prev, [lang]: { ...prev[lang], compileCmd: e.target.value } } : prev))
                  }
                  className={`${inputClass} resize-y`}
                />
              </label>

              <label className="mt-3 flex flex-col gap-1 text-xs text-fg-muted">
                runCmd (줄바꿈으로 구분)
                <textarea
                  rows={3}
                  value={edit[lang].runCmd}
                  onChange={(e) =>
                    setEdit((prev) => (prev ? { ...prev, [lang]: { ...prev[lang], runCmd: e.target.value } } : prev))
                  }
                  className={`${inputClass} resize-y`}
                />
              </label>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => saveLang(lang)}
                  disabled={savingLang === lang}
                  className="rounded bg-[var(--color-brand)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
                >
                  {savingLang === lang ? '저장 중...' : '저장'}
                </button>
                {savedLang === lang && <span className="text-xs font-bold text-[var(--color-ac)]">저장됨</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
