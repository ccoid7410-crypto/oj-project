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
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor';
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
    <div className="absolute left-0 top-full mt-2 z-50 flex w-[230px] flex-col rounded border border-ink-200 bg-white shadow-lg p-3 cursor-default" onClick={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-7 gap-1">
        {COLOR_PALETTE.map((c, i) => (
          <button
            key={i}
            onClick={() => { onChange(c); onClose(); }}
            className={`relative flex h-6 w-6 items-center justify-center rounded-full border border-ink-200 transition-transform hover:scale-110 ${c === 'transparent' ? 'bg-white' : ''}`}
            style={{ backgroundColor: c !== 'transparent' ? c : undefined }}
          >
            {c === 'transparent' && <div className="absolute h-[120%] w-[1.5px] rotate-45 bg-red-400" />}
            {selectedColor === c && (
              <span className={`text-[11px] font-bold ${c === '#FFFFFF' || c === 'transparent' ? 'text-black' : 'text-white'}`}>✓</span>
            )}
          </button>
        ))}
      </div>
      <div className="my-3 h-px w-full bg-ink-200" />
      <div className="flex items-center gap-2">
        <div 
          className="h-6 w-6 flex-shrink-0 rounded-full border border-ink-200 relative overflow-hidden"
          style={{ backgroundColor: hexInput === 'transparent' ? 'white' : hexInput }}
        >
           {hexInput === 'transparent' && <div className="absolute top-0 left-1/2 h-full w-[1.5px] -translate-x-1/2 rotate-45 bg-red-400" />}
        </div>
        <input 
          type="text" 
          value={hexInput === 'transparent' ? '' : hexInput}
          onChange={(e) => setHexInput(e.target.value)}
          placeholder="#FFFFFF"
          className="flex-1 w-0 rounded border border-ink-200 px-2 py-1 text-sm outline-none focus:border-[var(--color-brand)]"
        />
        <button 
          onClick={() => { onChange(hexInput || 'transparent'); onClose(); }}
          className="rounded border border-ink-200 px-3 py-1 text-sm transition-colors hover:bg-ink-100"
        >
          입력
        </button>
      </div>
    </div>
  );
}

interface MarkdownEditorProps {
  title: string;
  onTitleChange: (title: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

export function MarkdownEditor({
  title,
  onTitleChange,
  content,
  onContentChange,
  placeholder = '문제 설명을 입력하세요... (슬래시(/)나 # 등의 마크다운 단축키를 사용할 수 있습니다)',
  className = '',
}: MarkdownEditorProps) {
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const bgColorPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isBgColorPickerOpen, setIsBgColorPickerOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingImage, setEditingImage] = useState<{ src: string; pos: number } | null>(null);
  
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

    const handleOpenEditor = (e: Event) => {
      const customEvent = e as CustomEvent;
      setEditingImage(customEvent.detail);
    };
    window.addEventListener('open-image-editor', handleOpenEditor);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('open-image-editor', handleOpenEditor);
    };
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setIsUploading(true);
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
      
      if (!res.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await res.json();
      editor?.chain().focus().insertContent({
        type: 'image',
        attrs: { src: data.url }
      }).run();
    } catch (error) {
      alert('이미지 업로드에 실패했습니다. (png, jpeg, webp, gif만 가능합니다)');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveEditedImage = async (editedImageObject: any) => {
    if (!editingImage) return;
    try {
      const res = await fetch(editedImageObject.imageBase64);
      const blob = await res.blob();
      const file = new File([blob], 'edited-image.png', { type: 'image/png' });

      const formData = new FormData();
      formData.append('image', file);
      
      const token = localStorage.getItem('oj_token');
      const uploadRes = await fetch('/api/uploads/image', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      
      if (!uploadRes.ok) throw new Error('Upload failed');
      const data = await uploadRes.json();
      
      editor?.chain().focus().setNodeSelection(editingImage.pos).insertContent({
        type: 'image',
        attrs: { src: data.url }
      }).run();
    } catch (err) {
      alert('편집된 이미지 저장에 실패했습니다.');
    } finally {
      setEditingImage(null);
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
    onUpdate: ({ editor }) => {
      // tiptap-markdown이 제공하는 getMarkdown()을 사용하여 현재 편집 내용을 마크다운 문자열로 가져옵니다.
      // TypeScript가 extension의 storage 타입을 인식하지 못할 수 있으므로 any로 단언합니다.
      const markdown = (editor.storage as any).markdown.getMarkdown();
      onContentChange(markdown);
    },
    editorProps: {
      attributes: {
        // 커스텀 CSS(.ProseMirror)를 통해 스타일링됩니다.
        class: 'min-h-[400px] outline-none',
      },
    },
  });

  // 컴포넌트가 처음 렌더링되거나 에디터 내용이 비어있을 때만 외부 content를 주입합니다.
  useEffect(() => {
    if (editor && content && editor.isEmpty) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  return (
    <div className={`flex min-h-[calc(100vh-64px)] w-full min-w-0 flex-col bg-transparent px-4 lg:px-8 ${className}`}>
      {/* 에디터 캔버스 */}
      <div className="mx-auto mt-4 mb-16 flex w-full max-w-[850px] flex-1 flex-col rounded-2xl border border-ink-600 bg-surface shadow-sm overflow-hidden">
        {/* 상단 고정 툴바 */}
        <div className="sticky top-0 z-10 w-full border-b border-ink-600 bg-surface/95 px-6 py-3 backdrop-blur-md">
        {editor && (
          <div className="flex flex-wrap items-center gap-1">
            <ToolbarButton
              icon={<span className="font-bold font-serif text-[17px]">B</span>}
              title="굵게"
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
            />
            <ToolbarButton
              icon={<span className="font-serif italic text-[17px]">I</span>}
              title="기울임"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
            />
            <ToolbarButton
              icon={<span className="font-serif text-[17px] underline decoration-ink-400">U</span>}
              title="밑줄"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive('underline')}
            />
            <ToolbarButton
              icon={<span className="font-serif text-[17px] line-through decoration-ink-400">T</span>}
              title="취소선"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive('strike')}
            />
            
            <div className="mx-1 h-5 w-px bg-ink-200" />
            
            {/* 글자 색상 선택기 */}
            <div className="relative flex items-center" ref={colorPickerRef}>
              <div className="group relative flex">
                <button
                  type="button"
                  onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                  className={`flex h-9 min-w-9 flex-col items-center justify-center rounded-lg px-2 text-sm font-bold transition-all duration-200 active:scale-95 ${isColorPickerOpen ? 'bg-ink-100 text-fg' : 'text-fg-muted hover:bg-ink-100 hover:text-fg'}`}
                >
                  <span className="flex items-end font-serif text-[15px] font-bold leading-none">
                    T<span className="ml-[1px] text-[20px] leading-[0.5]">•</span>
                  </span>
                  <div 
                    className="mt-[3px] h-[3px] w-4 rounded-full"
                    style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000000' }}
                  />
                </button>
                <div className="pointer-events-none absolute top-full left-1/2 z-[100] mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-fg px-2 py-1 text-xs text-surface opacity-0 transition-opacity after:absolute after:bottom-full after:left-1/2 after:-translate-x-1/2 after:border-[5px] after:border-transparent after:border-b-fg group-hover:opacity-100">
                  글자 색상
                </div>
              </div>

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

            {/* 배경 색상 선택기 */}
            <div className="relative flex items-center" ref={bgColorPickerRef}>
              <div className="group relative flex">
                <button
                  type="button"
                  onClick={() => setIsBgColorPickerOpen(!isBgColorPickerOpen)}
                  className={`flex h-9 min-w-9 flex-col items-center justify-center rounded-lg px-2 text-sm font-bold transition-all duration-200 active:scale-95 ${isBgColorPickerOpen ? 'bg-ink-100 text-fg' : 'text-fg-muted hover:bg-ink-100 hover:text-fg'}`}
                >
                  <span className="mt-0.5 rounded-[3px] border-2 border-current px-[2px] py-[1px] font-serif text-[13px] font-bold leading-none">
                    T
                  </span>
                  <div 
                    className="mt-[4px] h-[3px] w-4 rounded-full border border-ink-200"
                    style={{ backgroundColor: editor.getAttributes('highlight').color || 'transparent' }}
                  />
                </button>
                <div className="pointer-events-none absolute top-full left-1/2 z-[100] mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-fg px-2 py-1 text-xs text-surface opacity-0 transition-opacity after:absolute after:bottom-full after:left-1/2 after:-translate-x-1/2 after:border-[5px] after:border-transparent after:border-b-fg group-hover:opacity-100">
                  배경 색상
                </div>
              </div>

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

            <div className="mx-1 h-5 w-px bg-ink-200" />
            
            <select
              value={[1, 2, 3, 4, 5, 6].find(level => editor.isActive('heading', { level })) || 0}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val === 0) editor.chain().focus().setParagraph().run();
                else editor.chain().focus().toggleHeading({ level: val as any }).run();
              }}
              className="h-9 rounded-lg border-none bg-transparent px-2 text-sm font-medium text-fg-muted outline-none transition-colors hover:bg-ink-100 focus:ring-2 focus:ring-[var(--color-brand)]"
            >
              <option value={0}>본문</option>
              <option value={1}>제목 1</option>
              <option value={2}>제목 2</option>
              <option value={3}>제목 3</option>
              <option value={4}>제목 4</option>
              <option value={5}>제목 5</option>
              <option value={6}>제목 6</option>
            </select>
            
            <div className="mx-1 h-5 w-px bg-ink-200" />
            
            <ToolbarButton
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h12M3 18h18"/></svg>}
              title="좌측 정렬"
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              isActive={editor.isActive({ textAlign: 'left' })}
            />
            <ToolbarButton
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M6 12h12M3 18h18"/></svg>}
              title="가운데 정렬"
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              isActive={editor.isActive({ textAlign: 'center' })}
            />
            <ToolbarButton
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M9 12h12M3 18h18"/></svg>}
              title="우측 정렬"
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              isActive={editor.isActive({ textAlign: 'right' })}
            />
            <ToolbarButton
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>}
              title="양쪽 정렬"
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              isActive={editor.isActive({ textAlign: 'justify' })}
            />
            
            <div className="mx-1 h-5 w-px bg-ink-200" />
            <ToolbarButton
              icon={<span className="font-serif text-2xl font-bold leading-none mt-1">"</span>}
              title="인용구"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive('blockquote')}
            />
            <ToolbarButton
              icon={<span className="font-mono text-[15px] font-bold">&lt;&gt;</span>}
              title="코드블럭"
              onClick={() => setIsCodeblockModalOpen(true)}
              isActive={editor.isActive('codeBlock')}
            />
            
            <div className="group relative flex">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-[17px] transition-all duration-200 text-fg-muted hover:bg-ink-100 hover:text-fg active:scale-95 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isUploading ? '⏳' : '🖼️'}
              </button>
              <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded bg-fg px-2 py-1 text-xs text-surface opacity-0 transition-opacity group-hover:opacity-100 z-[100] after:absolute after:bottom-full after:left-1/2 after:-translate-x-1/2 after:border-[5px] after:border-transparent after:border-b-fg">
                이미지 첨부
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/png, image/jpeg, image/webp, image/gif"
                onChange={handleImageUpload}
              />
            </div>
            <div className="mx-1 h-5 w-px bg-ink-200" />
            <ToolbarButton
              icon={<span className="text-[17px]">↩</span>}
              title="실행 취소"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
            />
            <ToolbarButton
              icon={<span className="text-[17px]">↪</span>}
              title="다시 실행"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
            />
          </div>
        )}
      </div>

      <div className="px-10 pb-12 pt-8 flex-1 flex flex-col">
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="제목을 입력하세요 (업데이트 V2 적용됨!)"
          className="w-full border-none bg-transparent py-4 text-4xl font-bold outline-none placeholder:text-ink-400"
        />

        <div className="my-6 h-px w-full bg-ink-200" />

        <div className="flex-1 markdown-body">
          <EditorContent editor={editor} className="h-full w-full" />
        </div>
      </div>
    </div>

      {/* 고급 이미지 에디터 모달 */}
      {editingImage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[90vw] h-[90vh] bg-white rounded shadow-xl overflow-hidden flex flex-col">
             <FilerobotImageEditor
                source={editingImage.src}
                onSave={handleSaveEditedImage}
                onClose={() => setEditingImage(null)}
                annotationsCommon={{ fill: '#ff0000' }}
                Text={{ text: '텍스트를 입력하세요...' }}
                Watermark={{
                  gallery: [],
                }}
                tabsIds={[TABS.ADJUST, TABS.ANNOTATE, TABS.WATERMARK]} 
                defaultTabId={TABS.ADJUST}
                defaultToolId={TOOLS.CROP}
                savingPixelRatio={4}
                previewPixelRatio={window.devicePixelRatio || 1}
             />
          </div>
        </div>
      )}

      {/* 코드블럭 모달 */}
      {isCodeblockModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[800px] h-[500px] bg-white rounded shadow-xl flex flex-col overflow-hidden">
            <div className="border-b border-ink-300 p-4 font-bold flex justify-between items-center">
              <span>코드블럭 삽입</span>
              <button onClick={() => setIsCodeblockModalOpen(false)} className="text-ink-500 hover:text-black">✕</button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <div className="w-48 border-r border-ink-300 bg-ink-100 overflow-y-auto">
                {['Bash', 'C', 'C++', 'C#', 'CSS', 'Go', 'HTML', 'Java', 'JavaScript', 'JSON', 'Kotlin', 'PHP', 'Python', 'Ruby', 'Rust', 'SQL', 'Swift', 'TypeScript'].map(lang => (
                  <button
                    key={lang}
                    onClick={() => setCodeblockLanguage(lang.toLowerCase())}
                    className={`w-full text-left px-4 py-2 text-sm ${codeblockLanguage === lang.toLowerCase() ? 'bg-white font-bold text-[var(--color-brand)]' : 'hover:bg-ink-200'}`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <textarea
                className="flex-1 p-4 outline-none resize-none bg-[#0d1117] text-[#c9d1d9] font-mono text-sm leading-relaxed"
                placeholder="여기에 코드를 입력하세요..."
                value={codeblockCode}
                onChange={e => setCodeblockCode(e.target.value)}
              />
            </div>
            <div className="border-t border-ink-300 p-4 flex justify-end gap-2 bg-ink-100">
              <button onClick={() => setIsCodeblockModalOpen(false)} className="px-6 py-2 rounded border border-ink-300 bg-white hover:bg-ink-200 font-medium">취소</button>
              <button onClick={() => {
                if (codeblockCode.trim()) {
                  editor?.chain().focus().insertContent({
                    type: 'codeBlock',
                    attrs: { language: codeblockLanguage },
                    content: [{ type: 'text', text: codeblockCode }]
                  }).run();
                } else {
                  editor?.chain().focus().insertContent({
                    type: 'codeBlock',
                    attrs: { language: codeblockLanguage },
                  }).run();
                }
                setIsCodeblockModalOpen(false);
                setCodeblockCode('');
              }} className="px-6 py-2 rounded bg-black text-white hover:bg-ink-800 font-medium">확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  icon,
  title,
  onClick,
  isActive,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="group relative flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm transition-all duration-200
          ${isActive ? 'bg-[var(--color-brand)] text-white shadow-sm' : 'text-fg-muted hover:bg-ink-100 hover:text-fg'}
          ${disabled ? 'opacity-30 cursor-not-allowed' : 'active:scale-95'}`}
      >
        {icon}
      </button>
      <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded bg-fg px-2 py-1 text-xs text-surface opacity-0 transition-opacity group-hover:opacity-100 z-[100] after:absolute after:bottom-full after:left-1/2 after:-translate-x-1/2 after:border-[5px] after:border-transparent after:border-b-fg">
        {title}
      </div>
    </div>
  );
}
