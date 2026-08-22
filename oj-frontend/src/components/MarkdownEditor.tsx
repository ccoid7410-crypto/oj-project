import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { CustomImage } from './CustomImage';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { lowlight } from 'lowlight';
import 'highlight.js/styles/github.css';

const EasterEggExtension = Extension.create({
  name: 'easterEgg',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('easterEgg'),
        state: {
          init(_, { doc }) {
            return getDecorations(doc);
          },
          apply(transaction, oldState) {
            return transaction.docChanged ? getDecorations(transaction.doc) : oldState;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];

    function getDecorations(doc: any) {
      const decorations: Decoration[] = [];
      doc.descendants((node: any, pos: number) => {
        if (!node.isText) return;
        const text = node.text;
        if (!text) return;

        const regex = /최온유/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const from = pos + match.index;
          const to = from + match[0].length;
          decorations.push(
            Decoration.inline(from, to, {
              class: 'easter-egg-rainbow',
            })
          );
        }
      });
      return DecorationSet.create(doc, decorations);
    }
  },
});

const COLOR_PALETTE = [
  'transparent', '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
  '#FF0000', '#FF9900', '#FFCC00', '#009966', '#0066CC', '#9933CC', '#7986CB',
  '#FFCDD2', '#FFCC99', '#FFF59D', '#A5D6A7', '#90CAF9', '#CE93D8', '#B0BEC5',
  '#F06292', '#FF8A65', '#C0CA33', '#43A047', '#039BE5', '#5E35B1', '#81C784',
  '#880E4F', '#BF360C', '#827717', '#1B5E20', '#01579B', '#311B92', '#37474F'
];

function ColorPickerPopup({
  selectedColor,
  onChange,
  onClose
}: {
  selectedColor: string | null;
  onChange: (color: string) => void;
  onClose: () => void;
}) {
  const [hexInput, setHexInput] = useState(selectedColor || 'transparent');

  return (
    <div
      className="absolute left-0 top-full z-50 mt-2 flex w-[230px] cursor-default flex-col rounded border border-ink-500 bg-[var(--color-surface)] p-3 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-7 gap-1">
        {COLOR_PALETTE.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { onChange(c); onClose(); }}
            className={`relative flex h-6 w-6 items-center justify-center rounded-full border border-ink-500 transition-transform hover:scale-110 ${c === 'transparent' ? 'bg-[var(--color-surface)]' : ''}`}
            style={{ backgroundColor: c !== 'transparent' ? c : undefined }}
          >
            {c === 'transparent' && <span className="absolute h-[120%] w-[1.5px] rotate-45 bg-[var(--color-wa)]" />}
            {selectedColor === c && (
              <span className={`text-[11px] font-bold ${c === '#FFFFFF' || c === 'transparent' ? 'text-fg' : 'text-white'}`}>✓</span>
            )}
          </button>
        ))}
      </div>
      <div className="my-3 h-px w-full bg-ink-600" />
      <div className="flex items-center gap-2">
        <span
          className="relative h-6 w-6 flex-shrink-0 overflow-hidden rounded-full border border-ink-500"
          style={{ backgroundColor: hexInput === 'transparent' ? undefined : hexInput }}
        >
          {hexInput === 'transparent' && (
            <span className="absolute left-1/2 top-0 h-full w-[1.5px] -translate-x-1/2 rotate-45 bg-[var(--color-wa)]" />
          )}
        </span>
        <input
          type="text"
          value={hexInput === 'transparent' ? '' : hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          placeholder="#FFFFFF"
          className="w-0 flex-1 rounded border border-ink-500 bg-[var(--color-surface)] px-2 py-1 text-sm outline-none focus:border-[var(--color-brand)]"
        />
        <button
          type="button"
          onClick={() => { onChange(hexInput || 'transparent'); onClose(); }}
          className="rounded border border-ink-500 px-3 py-1 text-sm transition-colors hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
        >
          입력
        </button>
      </div>
    </div>
  );
}

/** 툴바 아이콘은 모두 같은 규격(18px, 선 굵기 2, currentColor)으로 그린다. */
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const ICONS = {
  bold: <Icon><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" /><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" /></Icon>,
  italic: <Icon><path d="M18 5h-6M12 19H6M15 5l-4 14" /></Icon>,
  underline: <Icon><path d="M7 4v6a5 5 0 0 0 10 0V4" /><path d="M5 20h14" /></Icon>,
  strike: <Icon><path d="M4 12h16" /><path d="M16.5 7.5A4 4 0 0 0 13 6h-1.5C9.6 6 8 7.1 8 8.8c0 1.2.8 2.1 2.2 2.7" /><path d="M7.5 16.5A4 4 0 0 0 11 18h1.5c1.9 0 3.5-1.1 3.5-2.8 0-.7-.3-1.3-.8-1.8" /></Icon>,
  textColor: <Icon><path d="M5 18L11 5l6 13" /><path d="M7.5 14h7" /></Icon>,
  highlight: <Icon><path d="M4 20h16" /><path d="M14 4l6 6-8 7H7v-5z" /></Icon>,
  alignLeft: <Icon><path d="M4 6h16M4 12h10M4 18h16" /></Icon>,
  alignCenter: <Icon><path d="M4 6h16M7 12h10M4 18h16" /></Icon>,
  alignRight: <Icon><path d="M4 6h16M10 12h10M4 18h16" /></Icon>,
  alignJustify: <Icon><path d="M4 6h16M4 12h16M4 18h16" /></Icon>,
  quote: <Icon><path d="M4 5v14" /><path d="M9 7h11M9 12h11M9 17h6" /></Icon>,
  list: <Icon><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></Icon>,
  code: <Icon><path d="M16 18l5-6-5-6" /><path d="M8 6l-5 6 5 6" /></Icon>,
  image: <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 15l-5-5L5 20" /></Icon>,
  spinner: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  ),
  undo: <Icon><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-4" /></Icon>,
  redo: <Icon><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h4" /></Icon>,
};

const IMAGE_UPLOAD_ERROR = '이미지 업로드에 실패했습니다. (png, jpeg, webp, gif만 가능합니다)';

/** 이미지 파일 하나를 올리고 접근 URL을 돌려준다. */
async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);

  const token = localStorage.getItem('oj_token');
  const res = await fetch('/api/uploads/image', {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');

  const data = await res.json();
  return data.url as string;
}

/** 클립보드/드롭 데이터에서 이미지 파일만 골라낸다. */
function imageFilesOf(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files).filter((f) => f.type.startsWith('image/'));
}

interface MarkdownEditorProps {
  /** 제목 입력을 이 에디터 안에 둘 때만 넘긴다. 생략하면 본문만 그린다(게시글 작성 등). */
  title?: string;
  onTitleChange?: (title: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  /** 댓글처럼 짧은 입력에 쓰는 낮은 형태. 입력칸 높이와 여백을 줄인다. */
  compact?: boolean;
}

export function MarkdownEditor({
  title,
  onTitleChange,
  content,
  onContentChange,
  placeholder = '내용을 입력하세요',
  className = '',
  compact = false,
}: MarkdownEditorProps) {
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const bgColorPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isBgColorPickerOpen, setIsBgColorPickerOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [isCodeblockModalOpen, setIsCodeblockModalOpen] = useState(false);
  const [codeblockLanguage, setCodeblockLanguage] = useState('javascript');
  const [codeblockCode, setCodeblockCode] = useState('');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setIsColorPickerOpen(false);
      }
      if (bgColorPickerRef.current && !bgColorPickerRef.current.contains(e.target as Node)) {
        setIsBgColorPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const url = await uploadImage(file);
      editor?.chain().focus().insertContent({ type: 'image', attrs: { src: url } }).run();
    } catch {
      alert(IMAGE_UPLOAD_ERROR);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /**
   * 붙여넣기/드래그앤드롭으로 들어온 이미지를 올리고 그 자리에 끼워 넣는다.
   * 여기서는 editor 대신 ProseMirror view를 직접 쓴다 - 이 콜백들은 에디터가
   * 만들어질 때 한 번만 등록되므로, 그때의 editor 변수(아직 null)를 붙잡으면 안 된다.
   */
  const insertUploadedImages = async (view: EditorView, files: File[], pos?: number) => {
    setIsUploading(true);
    try {
      let at = pos ?? view.state.selection.from;
      for (const file of files) {
        const url = await uploadImage(file);
        const node = view.state.schema.nodes.image.create({ src: url });
        view.dispatch(view.state.tr.insert(at, node));
        at += node.nodeSize;
      }
    } catch {
      alert(IMAGE_UPLOAD_ERROR);
    } finally {
      setIsUploading(false);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline,
      EasterEggExtension,
      CustomImage,
      Markdown,
    ],
    content,
    // 커서를 옮기거나 서식을 껐을 때 툴바의 눌린 표시가 바로 따라오게 한다.
    // (기본값은 false여서 글자를 더 입력해야 갱신됐다)
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => {
      // tiptap-markdown이 제공하는 getMarkdown()을 사용하여 현재 편집 내용을 마크다운 문자열로 가져옵니다.
      // TypeScript가 extension의 storage 타입을 인식하지 못할 수 있으므로 any로 단언합니다.
      const markdown = (editor.storage as any).markdown.getMarkdown();
      onContentChange(markdown);
    },
    editorProps: {
      attributes: {
        // 커스텀 CSS(.ProseMirror)를 통해 스타일링됩니다.
        class: `${compact ? 'min-h-[110px]' : 'min-h-[400px]'} outline-none`,
      },
      // 툴바의 이미지 첨부 버튼 말고도, 그냥 붙여넣거나 끌어다 놓아도 올라간다.
      handlePaste(view, event) {
        const files = imageFilesOf(event.clipboardData);
        if (files.length === 0) return false;
        event.preventDefault();
        void insertUploadedImages(view, files);
        return true;
      },
      handleDrop(view, event, _slice, moved) {
        // 글 안에 있던 이미지를 옮기는 중이면 기본 동작(이동)에 맡긴다.
        // view.dragging까지 보는 이유: 브라우저가 끌고 있는 이미지를 파일로도 넘겨줘서
        // 그대로 두면 같은 이미지가 새로 첨부돼버린다.
        if (moved || view.dragging) return false;
        const files = imageFilesOf(event.dataTransfer);
        if (files.length === 0) return false;
        event.preventDefault();
        const dropped = view.posAtCoords({ left: event.clientX, top: event.clientY });
        void insertUploadedImages(view, files, dropped?.pos);
        return true;
      },
    },
  });

  // 컴포넌트가 처음 렌더링되거나 에디터 내용이 비어있을 때만 외부 content를 주입합니다.
  useEffect(() => {
    if (editor && content && editor.isEmpty) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  const headingLevel = [1, 2, 3, 4, 5, 6].find((level) => editor?.isActive('heading', { level })) || 0;

  return (
    /* 페이지 가운데 폭(main) 안에 들어가는 카드. 예전에는 화면 전체를 쓰는
       전용 레이아웃이었지만, 지금은 다른 페이지들과 같은 폭을 쓴다. */
    <div className={`flex w-full min-w-0 flex-col bg-transparent ${className}`}>
      <div className="flex w-full flex-1 flex-col overflow-hidden rounded-lg border border-ink-600 bg-[var(--color-surface)] shadow-sm">
        {/* 상단 고정 툴바. 모든 버튼이 같은 크기(32px)와 같은 아이콘 규격을 쓴다. */}
        <div className="sticky top-0 z-10 w-full border-b border-ink-600 bg-[var(--color-surface)] px-2 py-1.5">
          {editor && (
            <div className="flex flex-wrap items-center gap-0.5">
              <ToolbarButton
                icon={ICONS.bold}
                title="굵게"
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
              />
              <ToolbarButton
                icon={ICONS.italic}
                title="기울임"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
              />
              <ToolbarButton
                icon={ICONS.underline}
                title="밑줄"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                isActive={editor.isActive('underline')}
              />
              <ToolbarButton
                icon={ICONS.strike}
                title="취소선"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive('strike')}
              />

              <ToolbarDivider />

              {/* 글자 색상 */}
              <div className="relative flex items-center" ref={colorPickerRef}>
                <ToolbarButton
                  icon={ICONS.textColor}
                  title="글자 색"
                  onClick={() => setIsColorPickerOpen((v) => !v)}
                  isActive={isColorPickerOpen}
                  colorBar={editor.getAttributes('textStyle').color || 'currentColor'}
                />
                {isColorPickerOpen && (
                  <ColorPickerPopup
                    selectedColor={editor.getAttributes('textStyle').color || 'transparent'}
                    onChange={(c) => {
                      if (c === 'transparent') editor.chain().focus().unsetColor().run();
                      else editor.chain().focus().setColor(c).run();
                    }}
                    onClose={() => setIsColorPickerOpen(false)}
                  />
                )}
              </div>

              {/* 배경(형광펜) 색상 */}
              <div className="relative flex items-center" ref={bgColorPickerRef}>
                <ToolbarButton
                  icon={ICONS.highlight}
                  title="배경 색"
                  onClick={() => setIsBgColorPickerOpen((v) => !v)}
                  isActive={isBgColorPickerOpen}
                  colorBar={editor.getAttributes('highlight').color || 'transparent'}
                />
                {isBgColorPickerOpen && (
                  <ColorPickerPopup
                    selectedColor={editor.getAttributes('highlight').color || 'transparent'}
                    onChange={(c) => {
                      if (c === 'transparent') editor.chain().focus().unsetHighlight().run();
                      else editor.chain().focus().setHighlight({ color: c }).run();
                    }}
                    onClose={() => setIsBgColorPickerOpen(false)}
                  />
                )}
              </div>

              <ToolbarDivider />

              <select
                value={headingLevel}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val === 0) editor.chain().focus().setParagraph().run();
                  else editor.chain().focus().toggleHeading({ level: val as any }).run();
                }}
                title="글머리"
                className="h-8 rounded border border-ink-600 bg-transparent px-2 text-sm text-fg outline-none focus:border-[var(--color-brand)]"
              >
                <option value={0}>본문</option>
                <option value={1}>제목 1</option>
                <option value={2}>제목 2</option>
                <option value={3}>제목 3</option>
                <option value={4}>제목 4</option>
                <option value={5}>제목 5</option>
                <option value={6}>제목 6</option>
              </select>

              <ToolbarDivider />

              <ToolbarButton
                icon={ICONS.alignLeft}
                title="왼쪽 정렬"
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                isActive={editor.isActive({ textAlign: 'left' })}
              />
              <ToolbarButton
                icon={ICONS.alignCenter}
                title="가운데 정렬"
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                isActive={editor.isActive({ textAlign: 'center' })}
              />
              <ToolbarButton
                icon={ICONS.alignRight}
                title="오른쪽 정렬"
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                isActive={editor.isActive({ textAlign: 'right' })}
              />
              <ToolbarButton
                icon={ICONS.alignJustify}
                title="양쪽 정렬"
                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                isActive={editor.isActive({ textAlign: 'justify' })}
              />

              <ToolbarDivider />

              <ToolbarButton
                icon={ICONS.list}
                title="목록"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
              />
              <ToolbarButton
                icon={ICONS.quote}
                title="인용구"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive('blockquote')}
              />
              <ToolbarButton
                icon={ICONS.code}
                title="코드 블록"
                onClick={() => setIsCodeblockModalOpen(true)}
                isActive={editor.isActive('codeBlock')}
              />
              <ToolbarButton
                icon={isUploading ? ICONS.spinner : ICONS.image}
                title="이미지 첨부"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              />
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/png, image/jpeg, image/webp, image/gif"
                onChange={handleImageUpload}
              />

              <ToolbarDivider />

              <ToolbarButton
                icon={ICONS.undo}
                title="실행 취소"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
              />
              <ToolbarButton
                icon={ICONS.redo}
                title="다시 실행"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
              />
            </div>
          )}
        </div>

        <div className={`flex flex-1 flex-col ${compact ? 'px-3 pb-3 pt-2' : 'px-5 pb-8 pt-5'}`}>
          {onTitleChange && (
            <>
              <input
                type="text"
                value={title ?? ''}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="제목을 입력하세요"
                className="w-full border-none bg-transparent py-2 text-2xl font-bold outline-none placeholder:text-fg-muted"
              />
              <div className="my-4 h-px w-full bg-ink-600" />
            </>
          )}

          <div className="markdown-body flex-1">
            <EditorContent editor={editor} className="h-full w-full" />
          </div>
        </div>
      </div>

      {/* 코드블럭 모달 */}
      {isCodeblockModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[500px] w-[800px] max-w-full flex-col overflow-hidden rounded border border-ink-500 bg-[var(--color-surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-ink-600 p-4 font-bold">
              <span>코드 블록 삽입</span>
              <button
                type="button"
                onClick={() => setIsCodeblockModalOpen(false)}
                className="text-fg-muted hover:text-fg"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <div className="w-44 overflow-y-auto border-r border-ink-600 bg-ink-700">
                {['Bash', 'C', 'C++', 'C#', 'CSS', 'Go', 'HTML', 'Java', 'JavaScript', 'JSON', 'Kotlin', 'PHP', 'Python', 'Ruby', 'Rust', 'SQL', 'Swift', 'TypeScript'].map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setCodeblockLanguage(lang.toLowerCase())}
                    className={`w-full px-4 py-2 text-left text-sm ${
                      codeblockLanguage === lang.toLowerCase()
                        ? 'bg-[var(--color-surface)] font-bold text-[var(--color-brand)]'
                        : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <textarea
                className="flex-1 resize-none bg-[#0d1117] p-4 font-mono text-sm leading-relaxed text-[#c9d1d9] outline-none"
                placeholder="여기에 코드를 입력하세요..."
                value={codeblockCode}
                onChange={(e) => setCodeblockCode(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-ink-600 p-4">
              <button
                type="button"
                onClick={() => setIsCodeblockModalOpen(false)}
                className="rounded border border-ink-500 px-6 py-2 font-medium hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  editor?.chain().focus().insertContent({
                    type: 'codeBlock',
                    attrs: { language: codeblockLanguage },
                    ...(codeblockCode.trim() ? { content: [{ type: 'text', text: codeblockCode }] } : {}),
                  }).run();
                  setIsCodeblockModalOpen(false);
                  setCodeblockCode('');
                }}
                className="rounded bg-[var(--color-brand)] px-6 py-2 font-medium text-white hover:bg-[var(--color-brand-dim)]"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px bg-ink-600" />;
}

function ToolbarButton({
  icon,
  title,
  onClick,
  isActive,
  disabled,
  colorBar,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  /** 색상 버튼일 때 아이콘 아래에 지금 고른 색을 얇게 표시한다. */
  colorBar?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      className={`flex h-8 w-8 flex-col items-center justify-center rounded transition-colors ${
        isActive ? 'bg-[var(--color-brand)] text-white' : 'text-fg-muted hover:bg-ink-700 hover:text-fg'
      } ${disabled ? 'cursor-not-allowed opacity-30' : ''}`}
    >
      {icon}
      {colorBar !== undefined && (
        <span
          className="mt-0.5 h-[3px] w-4 rounded-full border border-ink-600"
          style={{ backgroundColor: colorBar === 'transparent' ? undefined : colorBar }}
        />
      )}
    </button>
  );
}
