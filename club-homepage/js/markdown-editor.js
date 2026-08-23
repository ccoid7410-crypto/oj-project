/**
 * 공용 마크다운 편집기 (OJ + 동아리 홈페이지 공통)
 * ------------------------------------------------------------------
 * 이 파일 하나가 두 사이트의 편집기다. 홈페이지는 <script>로 그대로 불러 쓰고,
 * OJ는 이 파일을 번들에 포함시켜 얇은 React 껍데기(MarkdownEditor.tsx)로 감싼다.
 * 그러니 편집기를 고칠 일이 있으면 여기만 고치면 된다.
 *
 * 편집 중에는 항상 마크다운 원문(raw)을 보여주고, 서식은 미리보기에서 확인한다.
 * 마크다운에 문법이 없는 밑줄·글자색·배경색·정렬은 HTML 조각으로 남긴다.
 *
 * 쓰는 법:
 *   const editor = DurunuriEditor.createMarkdownEditor({
 *     mount,                       // 편집기를 넣을 요소
 *     value: "",                   // 초기 마크다운
 *     placeholder: "내용을 입력하세요",
 *     compact: false,              // 댓글처럼 낮은 형태
 *     onChange: (markdown) => {},
 *     renderPreview: (markdown, container) => {},  // 미리보기 그리기(사이트마다 다름)
 *     uploadImage: async (file) => "url",          // 이미지 업로드(사이트마다 다름)
 *   });
 *   editor.getValue() / editor.setValue(v) / editor.destroy()
 */
(function (global) {
  "use strict";

  const IMAGE_UPLOAD_ERROR = "이미지 업로드에 실패했습니다. (png, jpeg, webp, gif만 가능합니다)";

  // ===== 원문(textarea) 편집 도구 =====

  /** React처럼 값을 관리하는 쪽이 있어도 상태가 따라오도록 네이티브 setter로 넣는다. */
  function setValue(area, value) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    );
    if (setter && setter.set) setter.set.call(area, value);
    else area.value = value;
    area.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /** 커서 자리에 글자를 넣는다. execCommand를 거쳐야 브라우저 실행취소 기록이 끊기지 않는다. */
  function typeInto(area, text) {
    area.focus();
    let inserted = false;
    try {
      inserted = document.execCommand("insertText", false, text);
    } catch {
      inserted = false;
    }
    if (inserted) return;

    const start = area.selectionStart;
    const next = area.value.slice(0, start) + text + area.value.slice(area.selectionEnd);
    setValue(area, next);
    area.selectionStart = area.selectionEnd = start + text.length;
  }

  function replaceRange(area, start, end, text) {
    area.focus();
    area.setSelectionRange(start, end);
    typeInto(area, text);
  }

  /** 선택 영역을 prefix/suffix로 감싼다. 선택이 없으면 placeholder를 넣고 그 부분을 선택해둔다. */
  function wrapSelection(area, prefix, suffix, placeholder) {
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const selected = area.value.slice(start, end) || placeholder || "";
    area.focus();
    area.setSelectionRange(start, end);
    typeInto(area, prefix + selected + suffix);
    area.selectionStart = start + prefix.length;
    area.selectionEnd = start + prefix.length + selected.length;
  }

  /** 커서가 놓인 줄의 시작/끝 위치. */
  function lineRange(area) {
    const pos = area.selectionStart;
    const start = area.value.lastIndexOf("\n", pos - 1) + 1;
    const lineEnd = area.value.indexOf("\n", pos);
    return { start, end: lineEnd === -1 ? area.value.length : lineEnd };
  }

  /** 줄 앞에 prefix를 붙인다(인용구·목록용). 이미 붙어 있으면 뗀다. */
  function prefixLine(area, prefix) {
    const { start, end } = lineRange(area);
    const line = area.value.slice(start, end);
    replaceRange(area, start, end, line.startsWith(prefix) ? line.slice(prefix.length) : prefix + line);
  }

  /** 제목 단계 지정(0이면 본문). 이미 붙어 있던 #은 지우고 다시 붙인다. */
  function setHeading(area, level) {
    const { start, end } = lineRange(area);
    const body = area.value.slice(start, end).replace(/^#{1,6}\s*/, "");
    replaceRange(area, start, end, level === 0 ? body : `${"#".repeat(level)} ${body}`);
  }

  const ALIGN_WRAP = /^<p style="text-align: (?:center|right|justify)">([\s\S]*)<\/p>$/;

  /** 문단 정렬. 마크다운에 문법이 없어 HTML로 남긴다. */
  function setAlign(area, align) {
    const { start, end } = lineRange(area);
    const line = area.value.slice(start, end);
    const unwrapped = ALIGN_WRAP.exec(line.trim());
    const body = unwrapped ? unwrapped[1] : line;
    replaceRange(
      area,
      start,
      end,
      align === "left" ? body : `<p style="text-align: ${align}">${body}</p>`,
    );
  }

  /** 선택 영역에 이미 같은 껍데기가 있으면 벗기고, 없으면 씌운다. */
  function toggleWrap(area, open, close, pattern, placeholder) {
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const found = pattern.exec(area.value.slice(start, end));
    if (found) {
      replaceRange(area, start, end, found[1]);
      return;
    }
    wrapSelection(area, open, close, placeholder);
  }

  function imageFilesOf(data) {
    if (!data) return [];
    return Array.from((data && data.files) || []).filter((f) => f.type.startsWith("image/"));
  }

  // ===== 아이콘 =====

  const ICON_ATTRS =
    'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

  function icon(paths) {
    return `<svg ${ICON_ATTRS}>${paths}</svg>`;
  }

  const ICONS = {
    bold: icon('<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z"/><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z"/>'),
    italic: icon('<path d="M18 5h-6M12 19H6M15 5l-4 14"/>'),
    underline: icon('<path d="M7 4v6a5 5 0 0 0 10 0V4"/><path d="M5 20h14"/>'),
    strike: icon(
      '<path d="M4 12h16"/><path d="M16.5 7.5A4 4 0 0 0 13 6h-1.5C9.6 6 8 7.1 8 8.8c0 1.2.8 2.1 2.2 2.7"/>' +
        '<path d="M7.5 16.5A4 4 0 0 0 11 18h1.5c1.9 0 3.5-1.1 3.5-2.8 0-.7-.3-1.3-.8-1.8"/>',
    ),
    textColor: icon('<path d="M5 18L11 5l6 13"/><path d="M7.5 14h7"/>'),
    highlight: icon('<path d="M4 20h16"/><path d="M14 4l6 6-8 7H7v-5z"/>'),
    alignLeft: icon('<path d="M4 6h16M4 12h10M4 18h16"/>'),
    alignCenter: icon('<path d="M4 6h16M7 12h10M4 18h16"/>'),
    alignRight: icon('<path d="M4 6h16M10 12h10M4 18h16"/>'),
    alignJustify: icon('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    list: icon('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>'),
    quote: icon('<path d="M4 5v14"/><path d="M9 7h11M9 12h11M9 17h6"/>'),
    link: icon(
      '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
        '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    ),
    code: icon('<path d="M16 18l5-6-5-6"/><path d="M8 6l-5 6 5 6"/>'),
    image: icon(
      '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5L5 20"/>',
    ),
    undo: icon('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/>'),
    redo: icon('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h4"/>'),
  };

  const COLOR_PALETTE = [
    "transparent", "#000000", "#333333", "#666666", "#999999", "#CCCCCC", "#FFFFFF",
    "#FF0000", "#FF9900", "#FFCC00", "#009966", "#0066CC", "#9933CC", "#7986CB",
    "#FFCDD2", "#FFCC99", "#FFF59D", "#A5D6A7", "#90CAF9", "#CE93D8", "#B0BEC5",
    "#F06292", "#FF8A65", "#C0CA33", "#43A047", "#039BE5", "#5E35B1", "#81C784",
    "#880E4F", "#BF360C", "#827717", "#1B5E20", "#01579B", "#311B92", "#37474F",
  ];

  // ===== DOM 만들기 =====

  function make(tag, props, children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "html") node.innerHTML = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children || []) if (child) node.appendChild(child);
    return node;
  }

  function toolButton(iconHtml, title, onClick) {
    return make("button", {
      type: "button",
      class: "md-tool",
      title,
      "aria-label": title,
      html: iconHtml,
      onclick: onClick,
    });
  }

  /** 색 버튼(아이콘 + 지금 색 막대) + 팔레트 팝업. */
  function colorTool(iconHtml, title, onPick) {
    const bar = make("span", { class: "md-tool-bar" });
    const button = make("button", {
      type: "button",
      class: "md-tool md-tool-color",
      title,
      "aria-label": title,
      html: iconHtml,
    });
    button.appendChild(bar);

    const pop = make("div", { class: "md-color-pop", hidden: true });
    for (const color of COLOR_PALETTE) {
      const swatch = make("button", {
        type: "button",
        class: "md-swatch" + (color === "transparent" ? " md-swatch-none" : ""),
        title: color === "transparent" ? "기본" : color,
        onclick: () => {
          bar.style.background = color === "transparent" ? "" : color;
          pop.hidden = true;
          onPick(color);
        },
      });
      if (color !== "transparent") swatch.style.background = color;
      pop.appendChild(swatch);
    }

    const wrap = make("span", { class: "md-tool-wrap" }, [button, pop]);
    button.addEventListener("click", () => {
      for (const other of document.querySelectorAll(".md-color-pop")) {
        if (other !== pop) other.hidden = true;
      }
      pop.hidden = !pop.hidden;
    });
    const closeOutside = (e) => {
      if (!wrap.contains(e.target)) pop.hidden = true;
    };
    document.addEventListener("mousedown", closeOutside);
    wrap._cleanup = () => document.removeEventListener("mousedown", closeOutside);
    return wrap;
  }

  /**
   * 링크 넣기 창. 표시할 내용과 주소를 따로 받는다.
   * (예전에는 주소만 물어봐서, 글자에 링크를 거는 흔한 경우가 어색했다.)
   */
  function openLinkDialog(area, onDone) {
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const selected = area.value.slice(start, end);

    const textInput = make("input", { class: "md-dialog-input", value: selected, placeholder: "예: 두루누리 홈페이지" });
    const urlInput = make("input", { class: "md-dialog-input", placeholder: "https://" });
    const error = make("p", { class: "md-dialog-error" });

    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }

    function submit() {
      const url = urlInput.value.trim();
      if (!url) {
        error.textContent = "링크 주소를 입력해주세요.";
        urlInput.focus();
        return;
      }
      const text = textInput.value.trim() || url;
      close();
      replaceRange(area, start, end, `[${text}](${url})`);
      if (onDone) onDone();
    }

    function onKey(e) {
      if (e.key === "Escape") close();
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    }

    const box = make("div", { class: "md-dialog" }, [
      make("h3", { class: "md-dialog-title", text: "링크 넣기" }),
      make("label", { class: "md-dialog-field" }, [
        make("span", { text: "표시할 내용" }),
        textInput,
      ]),
      make("label", { class: "md-dialog-field" }, [
        make("span", { text: "링크 주소" }),
        urlInput,
      ]),
      error,
      make("div", { class: "md-dialog-actions" }, [
        make("button", { type: "button", class: "md-dialog-btn", text: "취소", onclick: close }),
        make("button", { type: "button", class: "md-dialog-btn md-dialog-primary", text: "넣기", onclick: submit }),
      ]),
    ]);

    const overlay = make("div", {
      class: "md-dialog-overlay",
      onclick: (e) => {
        if (e.target === overlay) close();
      },
    }, [box]);

    document.body.appendChild(overlay);
    document.addEventListener("keydown", onKey);
    (selected ? urlInput : textInput).focus();
  }

  // ===== 본체 =====

  function createMarkdownEditor(options) {
    const {
      mount,
      value = "",
      placeholder = "내용을 입력하세요",
      compact = false,
      onChange,
      renderPreview,
      uploadImage,
    } = options;

    const cleanups = [];

    const area = make("textarea", {
      class: "md-input" + (compact ? " md-input-compact" : ""),
      placeholder,
      spellcheck: "false",
    });
    area.value = value;
    area.addEventListener("input", () => {
      if (onChange) onChange(area.value);
    });

    const preview = make("div", { class: "md-preview", hidden: true });

    // --- 이미지 ---
    const fileInput = make("input", {
      type: "file",
      class: "md-file",
      accept: "image/png, image/jpeg, image/webp, image/gif",
    });

    async function insertImage(file) {
      if (!uploadImage) return;
      const mark = `![업로드 중...${Math.random().toString(36).slice(2, 8)}]()`;
      typeInto(area, mark);
      let markdown = "";
      try {
        markdown = `![](${await uploadImage(file)})`;
      } catch {
        alert(IMAGE_UPLOAD_ERROR);
      }
      const at = area.value.indexOf(mark);
      if (at === -1) return;
      replaceRange(area, at, at + mark.length, markdown);
    }

    const imageBtn = toolButton(ICONS.image, "이미지 첨부", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      imageBtn.disabled = true;
      try {
        await insertImage(file);
      } finally {
        imageBtn.disabled = false;
        fileInput.value = "";
      }
    });

    // 버튼을 거치지 않고 붙여넣기·드래그앤드롭으로도 넣을 수 있다.
    area.addEventListener("paste", (event) => {
      const files = imageFilesOf(event.clipboardData);
      if (files.length === 0) return;
      event.preventDefault();
      for (const file of files) insertImage(file);
    });
    area.addEventListener("dragover", (event) => {
      if (imageFilesOf(event.dataTransfer).length > 0) event.preventDefault();
    });
    area.addEventListener("drop", (event) => {
      const files = imageFilesOf(event.dataTransfer);
      if (files.length === 0) return;
      event.preventDefault();
      for (const file of files) insertImage(file);
    });

    // --- 글머리 ---
    const headingSelect = make("select", { class: "md-select", title: "글머리", "aria-label": "글머리" });
    for (const [level, label] of [
      [0, "본문"], [1, "제목 1"], [2, "제목 2"], [3, "제목 3"],
      [4, "제목 4"], [5, "제목 5"], [6, "제목 6"],
    ]) {
      headingSelect.appendChild(make("option", { value: String(level), text: label }));
    }
    headingSelect.addEventListener("change", () => {
      setHeading(area, Number(headingSelect.value));
      headingSelect.value = "0";
    });

    // --- 미리보기 전환 ---
    const previewBtn = make("button", {
      type: "button",
      class: "md-preview-btn",
      text: "미리보기",
    });
    let previewing = false;
    function setPreviewing(on) {
      previewing = on;
      previewBtn.textContent = on ? "편집" : "미리보기";
      area.hidden = on;
      preview.hidden = !on;
      tools.hidden = on;
      if (!on) {
        area.focus();
        return;
      }
      preview.innerHTML = "";
      if (renderPreview) renderPreview(area.value, preview);
    }
    previewBtn.addEventListener("click", () => setPreviewing(!previewing));

    const separator = () => make("span", { class: "md-sep" });

    const colorText = colorTool(ICONS.textColor, "글자 색", (color) => {
      if (color === "transparent") {
        toggleWrap(area, "", "", /^<span style="color: [^"]*">([\s\S]*)<\/span>$/, "");
        return;
      }
      wrapSelection(area, `<span style="color: ${color}">`, "</span>", "글자");
    });
    const colorMark = colorTool(ICONS.highlight, "배경 색", (color) => {
      if (color === "transparent") {
        toggleWrap(area, "", "", /^<mark style="background-color: [^"]*">([\s\S]*)<\/mark>$/, "");
        return;
      }
      wrapSelection(area, `<mark style="background-color: ${color}">`, "</mark>", "글자");
    });
    cleanups.push(() => {
      if (colorText._cleanup) colorText._cleanup();
      if (colorMark._cleanup) colorMark._cleanup();
    });

    const tools = make("div", { class: "md-tools" }, [
      toolButton(ICONS.bold, "굵게", () => wrapSelection(area, "**", "**", "굵게")),
      toolButton(ICONS.italic, "기울임", () => wrapSelection(area, "*", "*", "기울임")),
      toolButton(ICONS.underline, "밑줄", () =>
        toggleWrap(area, "<u>", "</u>", /^<u>([\s\S]*)<\/u>$/, "밑줄"),
      ),
      toolButton(ICONS.strike, "취소선", () => wrapSelection(area, "~~", "~~", "취소선")),
      separator(),
      colorText,
      colorMark,
      separator(),
      headingSelect,
      separator(),
      toolButton(ICONS.alignLeft, "왼쪽 정렬", () => setAlign(area, "left")),
      toolButton(ICONS.alignCenter, "가운데 정렬", () => setAlign(area, "center")),
      toolButton(ICONS.alignRight, "오른쪽 정렬", () => setAlign(area, "right")),
      toolButton(ICONS.alignJustify, "양쪽 정렬", () => setAlign(area, "justify")),
      separator(),
      toolButton(ICONS.list, "목록", () => prefixLine(area, "- ")),
      toolButton(ICONS.quote, "인용구", () => prefixLine(area, "> ")),
      toolButton(ICONS.link, "링크", () => openLinkDialog(area)),
      toolButton(ICONS.code, "코드 블록", () => wrapSelection(area, "```\n", "\n```", "코드")),
      imageBtn,
      fileInput,
      separator(),
      toolButton(ICONS.undo, "실행 취소", () => {
        area.focus();
        document.execCommand("undo");
      }),
      toolButton(ICONS.redo, "다시 실행", () => {
        area.focus();
        document.execCommand("redo");
      }),
    ]);

    const bar = make("div", { class: "md-bar" }, [tools, previewBtn]);
    const root = make("div", { class: "md-editor" + (compact ? " md-editor-compact" : "") }, [
      bar,
      area,
      preview,
    ]);

    mount.appendChild(root);

    return {
      root,
      textarea: area,
      getValue: () => area.value,
      setValue: (next) => {
        if (area.value === next) return;
        area.value = next;
      },
      destroy() {
        for (const fn of cleanups) fn();
        root.remove();
      },
    };
  }

  global.DurunuriEditor = { createMarkdownEditor, IMAGE_UPLOAD_ERROR };
})(typeof window !== "undefined" ? window : globalThis);
