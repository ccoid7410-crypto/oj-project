// OJ 프론트의 MarkdownView와 동일하게 마크다운 + TeX(KaTeX)를 렌더링한다.
// 필요한 라이브러리(marked/DOMPurify/katex)는 account.html이 vendor/에서 먼저 로드한다.
// (CDN이 아니라 로컬 vendoring이라 사설망/오프라인에서도 동작한다.)
(function () {
  if (!window.marked || !window.katex || !window.DOMPurify) {
    // 라이브러리가 없으면 원문 텍스트로 폴백한다.
    window.renderMarkdown = (content) => {
      const div = document.createElement("div");
      div.textContent = content;
      return div;
    };
    return;
  }

  const blockMath = {
    name: "blockMath",
    level: "block",
    tokenizer(src) {
      const match = /^\$\$([\s\S]+?)\$\$/.exec(src);
      if (match) return { type: "blockMath", raw: match[0], text: match[1] };
    },
    renderer(token) {
      return window.katex.renderToString(token.text, { displayMode: true, throwOnError: false });
    },
  };

  const inlineMath = {
    name: "inlineMath",
    level: "inline",
    start(src) {
      return src.indexOf("$");
    },
    tokenizer(src) {
      const match = /^\$([^$\n]+?)\$/.exec(src);
      if (match) return { type: "inlineMath", raw: match[0], text: match[1] };
    },
    renderer(token) {
      return window.katex.renderToString(token.text, { throwOnError: false });
    },
  };

  window.marked.use({ extensions: [blockMath, inlineMath], gfm: true, breaks: true });

  /** 마크다운+TeX 문자열을 소독된 HTML을 담은 div로 반환한다. */
  window.renderMarkdown = (content) => {
    const raw = window.marked.parse(content, { async: false });
    const clean = window.DOMPurify.sanitize(raw, { USE_PROFILES: { html: true, mathMl: true } });
    const div = document.createElement("div");
    div.className = "markdown-body";
    div.innerHTML = clean;
    return div;
  };
})();
