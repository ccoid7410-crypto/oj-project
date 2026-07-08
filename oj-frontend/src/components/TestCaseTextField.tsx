import { FileTextLoader } from './FileTextLoader';

// 이 이상 길면 textarea에 전체를 렌더링하지 않는다 - 값 자체는 그대로 저장/제출되지만
// (제출 시엔 실제 value를 쓰지 화면에 보이는 값을 쓰는 게 아니다), 브라우저에 수만 자를
// 그대로 그리면 타이핑/스크롤이 눈에 띄게 느려진다.
const PREVIEW_LIMIT = 20_000;

export function TestCaseTextField({
  label,
  value,
  onChange,
  rows = 3,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  rows?: number;
  className?: string;
}) {
  const isLarge = value.length > PREVIEW_LIMIT;
  const displayValue = isLarge
    ? `${value.slice(0, PREVIEW_LIMIT)}\n\n... (총 ${value.length.toLocaleString()}자 중 앞부분만 표시됩니다. 전체 내용은 그대로 저장/제출됩니다)`
    : value;

  return (
    <label className="flex flex-col gap-1 text-xs text-fg-muted">
      <span className="flex items-center justify-between">
        {label}
        <FileTextLoader onLoad={onChange} />
      </span>
      <textarea
        required={!isLarge}
        rows={rows}
        value={displayValue}
        readOnly={isLarge}
        onChange={(e) => {
          if (!isLarge) onChange(e.target.value);
        }}
        className={`${className} ${isLarge ? 'cursor-not-allowed bg-ink-700' : ''}`}
      />
      {isLarge && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="self-start text-[10px] text-fg-muted underline hover:text-[var(--color-wa)]"
        >
          지우고 다시 입력/업로드
        </button>
      )}
    </label>
  );
}
