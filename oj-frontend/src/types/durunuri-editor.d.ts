/** club-homepage/js/markdown-editor.js 가 window에 붙여주는 공용 편집기. */
interface DurunuriEditorInstance {
  root: HTMLElement;
  textarea: HTMLTextAreaElement;
  getValue(): string;
  setValue(value: string): void;
  destroy(): void;
}

interface DurunuriEditorOptions {
  mount: HTMLElement;
  value?: string;
  placeholder?: string;
  compact?: boolean;
  onChange?: (value: string) => void;
  renderPreview?: (value: string, container: HTMLElement) => void;
  uploadImage?: (file: File) => Promise<string>;
}

interface Window {
  DurunuriEditor: {
    createMarkdownEditor(options: DurunuriEditorOptions): DurunuriEditorInstance;
    IMAGE_UPLOAD_ERROR: string;
  };
}
