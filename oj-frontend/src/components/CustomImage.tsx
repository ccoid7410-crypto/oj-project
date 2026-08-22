import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useRef } from 'react';

function ImageNodeView(props: any) {
  const { node, updateAttributes, selected } = props;
  const imageRef = useRef<HTMLImageElement>(null);

  /**
   * 모서리 핸들로 크기 조절. 가운데 정렬일 때는 양쪽이 같이 줄고 늘어나므로
   * 커서가 움직인 만큼의 두 배가 실제 너비 변화가 된다.
   */
  const startResize = (e: React.MouseEvent, direction: 1 | -1) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = imageRef.current?.offsetWidth || 0;
    const centered = node.attrs.align !== 'left' && node.attrs.align !== 'right';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) * direction * (centered ? 2 : 1);
      updateAttributes({ width: Math.max(100, Math.round(startWidth + deltaX)) });
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const align = node.attrs.align;

  const width = node.attrs.width
    ? typeof node.attrs.width === 'string' && node.attrs.width.endsWith('%')
      ? node.attrs.width
      : `${node.attrs.width}px`
    : 'auto';

  return (
    /* data-align은 바깥 컨테이너(.oj-image-node)의 정렬을 CSS에서 정하는 데 쓴다.
       컨테이너가 한 줄을 다 차지하면 이미지 옆 빈 곳을 눌러도 선택이 안 풀린다. */
    <NodeViewWrapper data-align={align} className="relative w-fit max-w-full">
      <img
        ref={imageRef}
        // data-drag-handle: 이 이미지를 끌면 에디터(ProseMirror)가 이동으로 처리한다.
        // 이게 없으면 브라우저 기본 이미지 드래그가 걸려서 같은 이미지가 새로 첨부된다.
        data-drag-handle
        draggable
        src={node.attrs.src}
        alt={node.attrs.alt ?? ''}
        title={node.attrs.title}
        className={`block max-w-full rounded ${selected ? 'ring-2 ring-[var(--color-brand)]' : ''}`}
        style={{ width, minWidth: '100px' }}
      />
      {selected && (
        <>
          <span
            onMouseDown={(e) => startResize(e, -1)}
            className="absolute -bottom-1.5 -left-1.5 h-3 w-3 cursor-nesw-resize rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-brand)]"
          />
          <span
            onMouseDown={(e) => startResize(e, 1)}
            className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-brand)]"
          />
        </>
      )}
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
    // className: tiptap이 감싸는 바깥 div에 붙는다. 폭을 이미지에 맞추는 CSS가 여기에 걸린다.
    return ReactNodeViewRenderer(ImageNodeView, { className: 'oj-image-node' });
  },
});
