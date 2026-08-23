import { useEffect, useRef } from 'react';
// 편집기 본체는 두 사이트가 함께 쓰는 파일 하나다. 여기서는 얇게 감싸기만 한다.
// 편집기를 고칠 일이 있으면 club-homepage/js/markdown-editor.js 를 고치면 두 사이트가 같이 바뀐다.
import '../../../club-homepage/js/markdown-editor.js';
import '../../../club-homepage/css/markdown-editor.css';
import { renderMarkdownToHtml } from '../lib/markdown';
import { uploadImage } from '../lib/uploadImage';

interface MarkdownEditorProps {
  /** 제목 입력을 이 편집기 안에 둘 때만 넘긴다. 생략하면 본문만 그린다(게시글 작성 등). */
  title?: string;
  onTitleChange?: (title: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  /** 댓글처럼 짧은 입력에 쓰는 낮은 형태. */
  compact?: boolean;
  /**
   * 미리보기를 직접 그리고 싶을 때(예: 멘션 칩). 생략하면 그냥 마크다운으로 그린다.
   * 컨테이너에 DOM을 채워 넣으면 된다.
   */
  renderPreview?: (content: string, container: HTMLElement) => void;
}

export function MarkdownEditor({
  title,
  onTitleChange,
  content,
  onContentChange,
  placeholder = '내용을 입력하세요',
  className = '',
  compact = false,
  renderPreview,
}: MarkdownEditorProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof window.DurunuriEditor.createMarkdownEditor> | null>(null);
  // 콜백이 매 렌더 바뀌어도 편집기를 다시 만들지 않도록 최신 것만 들고 있는다.
  const handlers = useRef({ onContentChange, renderPreview });
  handlers.current = { onContentChange, renderPreview };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const editor = window.DurunuriEditor.createMarkdownEditor({
      mount,
      value: content,
      placeholder,
      compact,
      onChange: (value: string) => handlers.current.onContentChange(value),
      uploadImage,
      renderPreview: (value: string, container: HTMLElement) => {
        const custom = handlers.current.renderPreview;
        if (custom) {
          custom(value, container);
          return;
        }
        const body = document.createElement('div');
        body.className = 'markdown-body';
        body.innerHTML = value.trim()
          ? renderMarkdownToHtml(value)
          : '<p class="text-fg-muted">내용이 없습니다.</p>';
        container.appendChild(body);
      },
    });
    editorRef.current = editor;
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // 편집기는 한 번만 만든다. 값 동기화는 아래 effect가 맡는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 바깥에서 값을 바꿔 넣었을 때만 반영한다(사용자가 치는 중에는 건드리지 않는다).
  useEffect(() => {
    editorRef.current?.setValue(content);
  }, [content]);

  return (
    <div className={`flex w-full min-w-0 flex-col ${className}`}>
      {onTitleChange && (
        <input
          type="text"
          value={title ?? ''}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="제목을 입력하세요"
          className="mb-3 w-full rounded border border-ink-500 bg-[var(--color-surface)] px-3 py-2 text-lg font-bold outline-none focus:border-[var(--color-brand)]"
        />
      )}
      <div ref={mountRef} />
    </div>
  );
}
