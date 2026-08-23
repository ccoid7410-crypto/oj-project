import { marked, type TokenizerAndRendererExtension } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// $...$ (인라인) / $$...$$ (블록) TeX 수식을 KaTeX로 렌더링하는 marked 확장.
// 수식 오류는 throwOnError:false로 빨간 글자 표시만 하고 페이지를 깨뜨리지 않는다.
const blockMath: TokenizerAndRendererExtension = {
  name: 'blockMath',
  level: 'block',
  tokenizer(src) {
    const match = /^\$\$([\s\S]+?)\$\$/.exec(src);
    if (match) return { type: 'blockMath', raw: match[0], text: match[1] };
  },
  renderer(token) {
    return katex.renderToString(token.text as string, { displayMode: true, throwOnError: false });
  },
};

const inlineMath: TokenizerAndRendererExtension = {
  name: 'inlineMath',
  level: 'inline',
  start(src) {
    return src.indexOf('$');
  },
  tokenizer(src) {
    // $$는 블록 수식이 먼저 처리하므로 여기서는 한 줄 안의 $...$만 잡는다.
    const match = /^\$([^$\n]+?)\$/.exec(src);
    if (match) return { type: 'inlineMath', raw: match[0], text: match[1] };
  },
  renderer(token) {
    return katex.renderToString(token.text as string, { throwOnError: false });
  },
};

marked.use({ extensions: [blockMath, inlineMath], gfm: true, breaks: true });

/**
 * 마크다운 + TeX를 소독된 HTML로 바꾼다.
 * 사용자 입력을 표시하므로 DOMPurify를 반드시 거친다.
 * (KaTeX 출력에 MathML이 섞여 있어 mathMl 프로필도 허용해야 수식이 살아남는다.)
 */
export function renderMarkdownToHtml(content: string): string {
  const raw = marked.parse(content, { async: false });
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true, mathMl: true } });
}
