import { useMemo } from 'react';
import { renderMarkdownToHtml } from '../lib/markdown';

/**
 * 마크다운 + TeX 렌더러. 실제 변환은 lib/markdown.ts가 맡는다
 * (공용 편집기의 미리보기도 같은 함수를 쓴다).
 */
export function MarkdownView({ content, className = '' }: { content: string; className?: string }) {
  const html = useMemo(() => renderMarkdownToHtml(content), [content]);

  return (
    <div
      className={`markdown-body text-sm leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
