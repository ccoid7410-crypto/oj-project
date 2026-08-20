import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useRef, useState, useEffect } from 'react';

function ImageNodeView(props: any) {
  const { node, updateAttributes, selected, getPos } = props;
  const imageRef = useRef<HTMLImageElement>(null);
  const [caption, setCaption] = useState(node.attrs.alt || '');

  // node.attrs.alt가 외부에서 변경될 경우 상태 동기화
  useEffect(() => {
    setCaption(node.attrs.alt || '');
  }, [node.attrs.alt]);

  const handleEdit = () => {
    window.dispatchEvent(new CustomEvent('open-image-editor', {
      detail: { src: node.attrs.src, pos: getPos() }
    }));
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    
    const startX = e.clientX;
    const startWidth = imageRef.current?.offsetWidth || 0;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // 드래그 방향에 따라 너비 계산 (우측 핸들을 잡았을 때)
      updateAttributes({ width: Math.max(100, startWidth + deltaX * 2) });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <NodeViewWrapper 
      className={`relative my-6 flex flex-col group ${
        node.attrs.align === 'left' ? 'items-start' : 
        node.attrs.align === 'right' ? 'items-end' : 
        'items-center'
      }`}
    >
      {/* Floating Toolbar when selected */}
      {selected && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-[60] flex gap-1 rounded bg-white p-1 shadow-md border border-ink-300">
          <button onClick={handleEdit} className="px-2 text-sm font-bold text-[var(--color-brand)] hover:bg-ink-100 rounded transition-colors">편집</button>
        </div>
      )}

      {/* Image with Resize Handles */}
      <div className="relative inline-block">
        <img
          ref={imageRef}
          src={node.attrs.src}
          alt={node.attrs.alt}
          title={node.attrs.title}
          className={`max-w-full rounded transition-all ${selected ? 'ring-2 ring-[var(--color-brand)] shadow-lg' : ''}`}
          style={{
            width: node.attrs.width ? (typeof node.attrs.width === 'string' && node.attrs.width.endsWith('%') ? node.attrs.width : `${node.attrs.width}px`) : 'auto',
            minWidth: '100px'
          }}
        />
        {/* Resize Handles (Show only when selected) */}
        {selected && (
          <>
            <div 
              onMouseDown={startResize}
              className="absolute -bottom-1.5 -right-1.5 h-4 w-4 rounded-full border-2 border-white bg-[var(--color-brand)] shadow-sm cursor-nwse-resize z-10"
            />
            <div 
              onMouseDown={(e) => {
                // 좌측 하단 핸들 로직
                e.preventDefault();
                const startX = e.clientX;
                const startWidth = imageRef.current?.offsetWidth || 0;
                const onMouseMove = (moveEvent: MouseEvent) => {
                  const deltaX = startX - moveEvent.clientX; // 반대 방향
                  updateAttributes({ width: Math.max(100, startWidth + deltaX * 2) });
                };
                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
              }}
              className="absolute -bottom-1.5 -left-1.5 h-4 w-4 rounded-full border-2 border-white bg-[var(--color-brand)] shadow-sm cursor-nesw-resize z-10"
            />
          </>
        )}
      </div>
      
      {/* 정적인 느낌을 주는 캡션 입력창 */}
      <input
        type="text"
        placeholder={selected ? "이미지를 설명해 보세요" : ""}
        value={caption}
        onChange={(e) => {
          setCaption(e.target.value);
          updateAttributes({ alt: e.target.value });
        }}
        className="mt-2 text-center text-sm text-fg-muted outline-none w-full max-w-[600px] bg-transparent placeholder:text-ink-300 transition-all focus:placeholder:opacity-100 hover:placeholder:opacity-100"
      />
    </NodeViewWrapper>
  );
}

export const CustomImage = Node.create({
  name: 'image',

  addOptions() {
    return {
      inline: false,
      allowBase64: false,
      HTMLAttributes: {},
    };
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? 'inline' : 'block';
  },

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      align: {
        default: 'center',
      },
      width: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
