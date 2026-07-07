import type { ChangeEvent } from 'react';

/** 작은 "파일에서 불러오기" 링크. 선택한 텍스트 파일 내용을 읽어서 onLoad로 넘겨준다. */
export function FileTextLoader({ onLoad }: { onLoad: (text: string) => void }) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onLoad(String(reader.result ?? ''));
    reader.readAsText(file);
    e.target.value = ''; // 같은 파일을 다시 선택해도 onChange가 또 발생하도록
  }

  return (
    <label className="cursor-pointer whitespace-nowrap text-[10px] text-fg-muted underline hover:text-[var(--color-brand)]">
      파일에서 불러오기
      <input type="file" accept=".txt,text/plain" onChange={handleChange} className="hidden" />
    </label>
  );
}
