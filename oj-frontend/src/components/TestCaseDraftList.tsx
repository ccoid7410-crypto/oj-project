import { useRef, useState, type DragEvent } from 'react';
import { parseTestCaseZip } from '../lib/testcaseZip';
import { TestCaseTextField } from './TestCaseTextField';

export interface TestCaseDraft {
  id?: string; // 기존에 저장된 케이스면 id가 있다(수정 페이지 통합 편집용). 새 케이스는 없음.
  input: string;
  output: string;
  isSample: boolean;
}

/**
 * 편집 가능한 테스트케이스 목록 + 상시 노출되는 zip 드롭존.
 * zip을 올리면 파싱한 .in/.out(.ans) 쌍이 아래 입력 칸에 그대로 채워지고,
 * 사용자가 직접 수정/삭제하거나 샘플 여부를 정할 수 있다. (직접 입력과 업로드가 한 흐름)
 */
export function TestCaseDraftList({
  value,
  onChange,
  inputClass = '',
}: {
  value: TestCaseDraft[];
  onChange: (drafts: TestCaseDraft[]) => void;
  inputClass?: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setWarnings([]);
    setParsing(true);
    try {
      const parsed = await parseTestCaseZip(file);
      setWarnings(parsed.warnings);
      // 업로드한 케이스를 편집 가능한 행으로 이어붙인다. 이미 있던 빈 행은 정리한다.
      const cleaned = value.filter((v) => v.input !== '' || v.output !== '');
      onChange([
        ...cleaned,
        ...parsed.cases.map((c) => ({ input: c.input, output: c.output, isSample: c.isSample })),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'zip 파일을 읽을 수 없습니다.');
    } finally {
      setParsing(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function update(index: number, patch: Partial<TestCaseDraft>) {
    onChange(value.map((tc, i) => (i === index ? { ...tc, ...patch } : tc)));
  }

  function addEmpty() {
    onChange([...value, { input: '', output: '', isSample: false }]);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 상시 노출 드롭존: zip을 올리면 아래 입력 칸에 내용이 채워진다 */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded border border-dashed px-4 py-5 text-center text-xs transition-colors ${
          dragOver
            ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)]'
            : 'border-ink-500 text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]'
        }`}
      >
        <p className="font-bold">{parsing ? '읽는 중...' : 'zip 파일을 끌어다 놓거나 클릭해서 불러오기'}</p>
        <p className="mt-1">
          <span className="font-mono">1.in</span> / <span className="font-mono">1.out</span>(또는{' '}
          <span className="font-mono">.ans</span>) 쌍이 아래 입력 칸에 채워집니다
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // 같은 파일 다시 선택 가능하도록
            if (file) handleFile(file);
          }}
          className="hidden"
        />
      </div>

      {warnings.map((w, i) => (
        <p key={i} className="text-xs text-[var(--color-tle)]">
          {w}
        </p>
      ))}
      {error && <p className="text-xs text-[var(--color-wa)]">{error}</p>}

      {value.map((tc, i) => (
        <div key={i} className="rounded border border-ink-500 bg-ink-700 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-3 text-xs">
              <span className="font-bold text-fg-muted">#{i + 1}</span>
              <label className="flex items-center gap-2 text-fg-muted">
                <input
                  type="checkbox"
                  checked={tc.isSample}
                  onChange={(e) => update(i, { isSample: e.target.checked })}
                />
                예제로 공개 (sample)
              </label>
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-xs text-fg-muted hover:text-[var(--color-wa)]"
            >
              삭제
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TestCaseTextField
              label="input"
              value={tc.input}
              onChange={(text) => update(i, { input: text })}
              className={`${inputClass} resize-y`}
            />
            <TestCaseTextField
              label="output"
              value={tc.output}
              onChange={(text) => update(i, { output: text })}
              className={`${inputClass} resize-y`}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addEmpty}
        className="self-start rounded border border-ink-500 px-2 py-1 text-xs hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
      >
        + 빈 칸 추가
      </button>
    </div>
  );
}
