import { lazy, Suspense } from 'react';

// 게시글 작성과 같은 공용 편집기를 쓰되, 무거워서(마크다운 렌더러 포함) 필요할 때 불러온다.
const MarkdownEditor = lazy(() =>
  import('./MarkdownEditor').then((m) => ({ default: m.MarkdownEditor })),
);

const MarkdownView = lazy(() =>
  import('./MarkdownView').then((m) => ({ default: m.MarkdownView })),
);

/**
 * 댓글·답글 입력칸. 글쓰기와 같은 공용 편집기라 서식·미리보기는 물론
 * 이미지도 버튼·붙여넣기·드래그앤드롭으로 넣을 수 있다.
 */
export function CommentEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <Suspense fallback={<p className="p-3 text-sm text-fg-muted">편집기 불러오는 중...</p>}>
      <MarkdownEditor compact content={value} onContentChange={onChange} placeholder={placeholder} />
    </Suspense>
  );
}

/** 댓글 본문. 마크다운(이미지 포함)으로 그린다. */
export function CommentBody({ content }: { content: string }) {
  return (
    <div className="markdown-body mt-1 text-sm">
      <Suspense fallback={<p className="whitespace-pre-wrap text-sm">{content}</p>}>
        <MarkdownView content={content} />
      </Suspense>
    </div>
  );
}
