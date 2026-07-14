import { useRef, useState, type DragEvent } from 'react';
import { parseTestCaseZip, type ParsedTestCase } from '../lib/testcaseZip';

/**
 * zip(.in/.out 또는 .ans 쌍)을 올려 여러 테스트케이스를 한 번에 추가하는 UI.
 * 파일을 고르면 zip 내용을 파싱해 쌍마다 샘플 체크박스를 띄우고, 추가 버튼으로 일괄 전송한다.
 */
export function TestCaseZipUploader({
  onAdd,
}: {
  onAdd: (cases: { input: string; output: string; isSample: boolean }[]) => Promise<void>;
}) {
  const [cases, setCases] = useState<ParsedTestCase[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setParsing(true);
    try {
      const parsed = await parseTestCaseZip(file);
      setCases(parsed.cases);
      setWarnings(parsed.warnings);
      setFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'zip 파일을 읽을 수 없습니다.');
      setCases([]);
      setWarnings([]);
      setFileName(null);
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

  function toggleSample(idx: number) {
    setCases((prev) => prev.map((c, i) => (i === idx ? { ...c, isSample: !c.isSample } : c)));
  }

  function reset() {
    setCases([]);
    setWarnings([]);
    setFileName(null);
    setError(null);
  }

  async function onSubmit() {
    if (cases.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAdd(cases.map((c) => ({ input: c.input, output: c.output, isSample: c.isSample })));
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : '테스트케이스 추가에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 드롭존 (클릭 선택 + 드래그앤드롭) */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded border border-dashed px-4 py-6 text-center text-xs transition-colors ${
          dragOver
            ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5 text-[var(--color-brand)]'
            : 'border-ink-500 text-fg-muted hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]'
        }`}
      >
        <p className="font-bold">{parsing ? '읽는 중...' : 'zip 파일을 여기에 끌어다 놓거나 클릭해서 선택'}</p>
        <p className="mt-1">
          <span className="font-mono">1.in</span> / <span className="font-mono">1.out</span>(또는{' '}
          <span className="font-mono">.ans</span>) 쌍을 담은 zip
        </p>
        {fileName && <p className="mt-1 text-fg">선택됨: {fileName}</p>}
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

      {cases.length > 0 && (
        <>
          <p className="text-xs text-fg-muted">
            {cases.length}개 쌍을 찾았습니다. 문제 페이지에 공개할 케이스만 샘플로 체크하세요.
          </p>
          <ul className="flex flex-col gap-2">
            {cases.map((c, idx) => (
              <li key={c.name} className="rounded border border-ink-500 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">
                    #{idx + 1} <span className="font-mono text-xs text-fg-muted">{c.name}</span>
                  </span>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={c.isSample} onChange={() => toggleSample(idx)} />
                    샘플로 공개(문제 페이지에 노출)
                  </label>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-fg-muted">입력</p>
                    <pre className="mt-1 max-h-32 overflow-auto rounded bg-ink-700 p-2 text-xs whitespace-pre-wrap">
                      {c.input || '(빈 입력)'}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs text-fg-muted">출력</p>
                    <pre className="mt-1 max-h-32 overflow-auto rounded bg-ink-700 p-2 text-xs whitespace-pre-wrap">
                      {c.output || '(빈 출력)'}
                    </pre>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
            >
              {submitting ? '추가 중...' : `${cases.length}개 테스트케이스 추가`}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={submitting}
              className="rounded border border-ink-500 px-3 py-2 text-xs text-fg-muted hover:border-[var(--color-wa)] hover:text-[var(--color-wa)] disabled:opacity-60"
            >
              취소
            </button>
          </div>
        </>
      )}
    </div>
  );
}
