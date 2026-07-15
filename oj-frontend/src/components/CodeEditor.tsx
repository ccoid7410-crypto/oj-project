/// <reference types="ace-builds" />
import { useEffect, useRef } from 'react';
import type { Language } from '../api/types';

// Ace 에디터. react-ace는 React 19 peer-dep 이슈가 있어 ace-builds를 직접 감싼다.
// (ace-builds는 src-noconflict/* 하위 경로를 ace-modules.d.ts에서 선언하므로 위 참조가 필요하다.)
// 모드/테마 파일은 CDN이 아니라 번들에 포함(사설망/오프라인 대응)되도록 정적 import 한다.
import ace from 'ace-builds/src-noconflict/ace';
import 'ace-builds/src-noconflict/mode-c_cpp';
import 'ace-builds/src-noconflict/mode-java';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-golang';
import 'ace-builds/src-noconflict/mode-markdown';
import 'ace-builds/src-noconflict/theme-textmate';
import 'ace-builds/src-noconflict/theme-one_dark';

// worker(문법 검사)까지 번들하면 무거워지고 채점은 서버가 하므로 문법 경고는 끈다.
ace.config.set('useWorker', false);

// 문제 채점 언어 → Ace 모드. 설명(마크다운)은 'markdown'을 직접 넘긴다.
const LANGUAGE_MODE: Record<Language, string> = {
  CPP: 'c_cpp',
  C: 'c_cpp',
  JAVA: 'java',
  PYTHON3: 'python',
  JAVASCRIPT: 'javascript',
  GO: 'golang',
};

export type EditorMode = Language | 'markdown';

function modeOf(mode: EditorMode): string {
  return mode === 'markdown' ? 'markdown' : LANGUAGE_MODE[mode];
}

function isDarkTheme(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function CodeEditor({
  value,
  onChange,
  mode,
  autoGrow,
  minLines = 8,
  maxLines = 40,
  heightClass = 'h-[420px]',
  readOnly = false,
}: {
  value: string;
  onChange: (next: string) => void;
  /** 코드면 Language, 설명이면 'markdown' */
  mode: EditorMode;
  /** true면 내용 줄 수에 맞춰 minLines~maxLines 사이에서 높이가 자동으로 늘어난다. */
  autoGrow?: boolean;
  minLines?: number;
  maxLines?: number;
  /** autoGrow가 아닐 때 쓰는 고정 높이(Tailwind 클래스). */
  heightClass?: string;
  readOnly?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof ace.edit> | null>(null);
  // onChange가 매 렌더 새로 만들어져도 리스너를 다시 달지 않도록 ref로 최신값을 참조한다.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // 최초 1회: 에디터 생성 + change 리스너.
  useEffect(() => {
    if (!containerRef.current) return;
    const editor = ace.edit(containerRef.current, {
      mode: `ace/mode/${modeOf(mode)}`,
      theme: isDarkTheme() ? 'ace/theme/one_dark' : 'ace/theme/textmate',
      fontSize: 13,
      tabSize: 4,
      useSoftTabs: true,
      showPrintMargin: false,
      highlightActiveLine: !readOnly,
      readOnly,
      // autoGrow면 줄 수에 맞춰 커지고, 아니면 컨테이너 고정 높이를 그대로 쓴다.
      ...(autoGrow ? { minLines, maxLines } : {}),
    });
    editor.setValue(value, -1); // -1: 커서를 문서 맨 앞으로(전체 선택 방지)
    editor.on('change', () => onChangeRef.current(editor.getValue()));
    editorRef.current = editor;

    // 테마(라이트/다크)가 바뀌면 Ace 테마도 따라 바꾼다.
    const observer = new MutationObserver(() => {
      editor.setTheme(isDarkTheme() ? 'ace/theme/one_dark' : 'ace/theme/textmate');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
      editor.destroy();
      editorRef.current = null;
    };
    // 생성 옵션들은 최초 1회만 반영한다(값/모드 갱신은 아래 effect가 담당).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 부모의 value가 코드 외부에서 바뀌면(언어 변경 템플릿, 초기 로딩 등) 에디터에 반영.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.getValue() !== value) editor.setValue(value, -1);
  }, [value]);

  // 언어(모드) 변경 반영.
  useEffect(() => {
    editorRef.current?.session.setMode(`ace/mode/${modeOf(mode)}`);
  }, [mode]);

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden rounded border border-ink-500 text-sm ${autoGrow ? '' : heightClass}`}
    />
  );
}
