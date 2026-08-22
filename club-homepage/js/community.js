// 두루누리 홈페이지 커뮤니티. OJ 커뮤니티와 같은 백엔드를 쓰되 board로 분리되어
// 글/태그를 공유하지 않는다. 한 페이지에서 URL 쿼리로 화면을 전환한다:
//   (없음)      → 게시글 목록
//   ?post=<id>  → 게시글 상세
//   ?new        → 글쓰기
//
// 이 스크립트를 공개 게시판(community.html, board=HOME)과 동아리 게시판
// (club-board.html, board=CLUB)이 함께 쓴다. CSP(script-src 'self') 때문에 HTML에서
// 인라인 <script>로 값을 넘길 수 없어 파일명으로 어느 게시판인지 판별한다.
const IS_CLUB_BOARD = window.location.pathname.includes("club-board");
const BOARD = IS_CLUB_BOARD ? "CLUB" : "HOME";
const BOARD_PAGE = IS_CLUB_BOARD ? "club-board.html" : "community.html";
const BOARD_TITLE = IS_CLUB_BOARD ? "동아리 게시판" : "공개 게시판";
const token = localStorage.getItem("oj_token");

function authFetch(path, options = {}) {
  const hasBody = options.body !== undefined;
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
}

async function authJson(path, options = {}) {
  const res = await authFetch(path, options);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || "요청에 실패했습니다.");
  return body;
}

/** 얇은 DOM 빌더 (account.js와 동일). */
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of Array.isArray(children) ? children : [children]) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  return node;
}

const root = document.getElementById("community-root");

/**
 * 작성자 표시(프로필 사진 + 사용자명). 누르면 그 사람의 OJ 프로필로 간다.
 * 목록 항목처럼 부모가 클릭을 가로채는 자리에서도 링크가 먼저 동작하도록 전파를 막는다.
 */
function authorLink(username, avatarVersion, size, className) {
  return el(
    "a",
    {
      class: "c-author-link" + (className ? " " + className : ""),
      href: `/users/${encodeURIComponent(username)}`,
      onclick: (e) => e.stopPropagation(),
    },
    [avatarNode(username, avatarVersion, size), document.createTextNode(" " + username)],
  );
}

function avatarNode(username, avatarVersion, size) {
  const span = el("span", { class: "c-avatar", style: `width:${size}px;height:${size}px` });
  if (avatarVersion) {
    span.appendChild(el("img", { src: `/api/users/${encodeURIComponent(username)}/avatar?v=${avatarVersion}`, alt: "" }));
  }
  return span;
}

const TYPE_LABEL = { NOTICE: "공지", UPDATE_LOG: "업데이트" };

/** 유형에 따른 제목 색 클래스. 공지=붉은색, 업데이트 로그=푸른색. */
function titleClass(type) {
  if (type === "NOTICE") return "c-title c-title-notice";
  if (type === "UPDATE_LOG") return "c-title c-title-update";
  return "c-title";
}

function typeBadge(type) {
  if (type === "NORMAL" || !type) return null;
  const cls = type === "NOTICE" ? "c-badge c-badge-notice" : "c-badge c-badge-update";
  return el("span", { class: cls }, TYPE_LABEL[type]);
}

function fmtDate(s) {
  return new Date(s).toLocaleDateString("ko-KR");
}
function fmtDateTime(s) {
  return new Date(s).toLocaleString("ko-KR");
}

/** 좋아요/싫어요 버튼 쌍. onVote(1|-1) 호출 시 부모가 API를 쳐서 갱신한다. */
function voteButtons(summary, onVote, size) {
  const wrap = el("div", { class: "c-votes" });
  const like = el(
    "button",
    { type: "button", class: "c-vote c-vote-up" + (summary.myVote === 1 ? " active" : ""), onclick: () => onVote(1) },
    `▲ ${summary.likeCount}`,
  );
  const dislike = el(
    "button",
    { type: "button", class: "c-vote c-vote-down" + (summary.myVote === -1 ? " active" : ""), onclick: () => onVote(-1) },
    `▼ ${summary.dislikeCount}`,
  );
  if (size === "md") {
    like.classList.add("c-vote-md");
    dislike.classList.add("c-vote-md");
  }
  wrap.append(like, dislike);
  return wrap;
}

function go(query) {
  window.location.href = BOARD_PAGE + query;
}

// ===== 멘션 =====

// 게시글 상세를 불러올 때 백엔드가 알려준, 실제로 존재하는 멘션 대상들.
let mentionUsers = new Map(); // username -> avatarVersion

/**
 * 렌더된 본문에서 @사용자명을 찾아 프로필 칩으로 바꾼다.
 * 존재하지 않는 사용자명은 멘션이 아닐 수 있으므로 원문 그대로 둔다.
 */
function applyMentions(container) {
  if (mentionUsers.size === 0) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const tag = node.parentNode && node.parentNode.nodeName;
      // 코드/링크 안의 @는 건드리지 않는다.
      if (tag === "CODE" || tag === "PRE" || tag === "A") return NodeFilter.FILTER_REJECT;
      return /@[A-Za-z0-9_-]{2,30}/.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const targets = [];
  while (walker.nextNode()) targets.push(walker.currentNode);

  for (const node of targets) {
    const frag = document.createDocumentFragment();
    let rest = node.nodeValue;
    const re = /@([A-Za-z0-9_-]{2,30})/g;
    let last = 0;
    let m;
    while ((m = re.exec(rest)) !== null) {
      const username = m[1];
      if (!mentionUsers.has(username)) continue; // 없는 계정 → 원문 유지
      frag.appendChild(document.createTextNode(rest.slice(last, m.index)));
      frag.appendChild(mentionChip(username, mentionUsers.get(username)));
      last = m.index + m[0].length;
    }
    if (last === 0) continue;
    frag.appendChild(document.createTextNode(rest.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
}

/** 작성자 표시와 같은 규격(아바타 + 아이디)의 인라인 멘션 칩. */
function mentionChip(username, avatarVersion) {
  const link = el("a", {
    class: "c-mention",
    href: `/users/${encodeURIComponent(username)}`,
  }, [avatarNode(username, avatarVersion, 16), document.createTextNode(username)]);
  return link;
}

// ===== 마크다운 툴바 =====
// ===== 마크다운 툴바 =====
// OJ 편집기(oj-frontend/src/components/MarkdownEditor.tsx)와 도구 구성·아이콘·순서를 맞춘다.
// 이쪽은 마크다운 원문을 직접 편집하는 textarea라, 마크다운에 문법이 없는 밑줄·색·정렬은
// OJ가 저장할 때 쓰는 것과 같은 HTML 조각으로 넣는다(그래야 양쪽이 서로 읽는다).

/** 입력칸에 글자를 넣는다. execCommand를 거쳐야 브라우저의 실행취소 기록이 끊기지 않는다. */
function typeInto(textarea, text) {
  textarea.focus();
  let inserted = false;
  try {
    inserted = document.execCommand("insertText", false, text);
  } catch {
    inserted = false;
  }
  if (inserted) return;
  // 폴백: 실행취소 기록은 끊기지만 입력은 되게 한다.
  const start = textarea.selectionStart;
  textarea.value =
    textarea.value.slice(0, start) + text + textarea.value.slice(textarea.selectionEnd);
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

/** 선택 영역을 prefix/suffix로 감싼다. 선택이 없으면 placeholder를 넣고 그 부분을 선택해둔다. */
function wrapSelection(textarea, prefix, suffix, placeholder) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || placeholder || "";
  textarea.focus();
  textarea.setSelectionRange(start, end);
  typeInto(textarea, prefix + selected + suffix);
  textarea.selectionStart = start + prefix.length;
  textarea.selectionEnd = start + prefix.length + selected.length;
}

/** 커서가 놓인 줄의 시작/끝 위치. */
function lineRange(textarea) {
  const pos = textarea.selectionStart;
  const start = textarea.value.lastIndexOf("\n", pos - 1) + 1;
  const lineEnd = textarea.value.indexOf("\n", pos);
  return { start, end: lineEnd === -1 ? textarea.value.length : lineEnd };
}

/** 지정한 구간을 새 문자열로 바꾼다. */
function replaceRange(textarea, start, end, text) {
  textarea.focus();
  textarea.setSelectionRange(start, end);
  typeInto(textarea, text);
}

/** 커서가 있는 줄 앞에 prefix를 붙인다(인용구·목록용). 이미 붙어 있으면 뗀다. */
function prefixLine(textarea, prefix) {
  const { start, end } = lineRange(textarea);
  const line = textarea.value.slice(start, end);
  const next = line.startsWith(prefix) ? line.slice(prefix.length) : prefix + line;
  replaceRange(textarea, start, end, next);
}

/** 제목 단계 지정(0이면 본문). 이미 붙어 있던 #은 지우고 다시 붙인다. */
function setHeading(textarea, level) {
  const { start, end } = lineRange(textarea);
  const body = textarea.value.slice(start, end).replace(/^#{1,6}\s*/, "");
  replaceRange(textarea, start, end, level === 0 ? body : `${"#".repeat(level)} ${body}`);
}

const ALIGN_WRAP = /^<p style="text-align: (?:center|right|justify)">([\s\S]*)<\/p>$/;

/** 문단 정렬. 마크다운에 문법이 없어 OJ와 같은 HTML로 남긴다. */
function setAlign(textarea, align) {
  const { start, end } = lineRange(textarea);
  const line = textarea.value.slice(start, end);
  const unwrapped = ALIGN_WRAP.exec(line.trim());
  const body = unwrapped ? unwrapped[1] : line;
  replaceRange(
    textarea,
    start,
    end,
    align === "left" ? body : `<p style="text-align: ${align}">${body}</p>`,
  );
}

/** 선택 영역에 이미 같은 종류의 HTML 껍데기가 있으면 벗기고, 없으면 씌운다. */
function toggleWrap(textarea, open, close, pattern, placeholder) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end);
  const found = pattern.exec(selected);
  if (found) {
    replaceRange(textarea, start, end, found[1]);
    return;
  }
  wrapSelection(textarea, open, close, placeholder);
}

const ICON_ATTRS =
  'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
  ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

function icon(paths) {
  return `<svg ${ICON_ATTRS}>${paths}</svg>`;
}

// OJ 툴바와 같은 아이콘(같은 path). 한쪽만 고치면 어긋나므로 모양을 맞춰 둔다.
const TOOLBAR_ICONS = {
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

function toolbarButton(html, title, onClick) {
  const b = el("button", {
    type: "button",
    class: "c-tool",
    title,
    "aria-label": title,
    onclick: onClick,
  });
  b.innerHTML = html;
  return b;
}

// OJ 색상 팔레트와 같은 목록.
const COLOR_PALETTE = [
  "transparent", "#000000", "#333333", "#666666", "#999999", "#CCCCCC", "#FFFFFF",
  "#FF0000", "#FF9900", "#FFCC00", "#009966", "#0066CC", "#9933CC", "#7986CB",
  "#FFCDD2", "#FFCC99", "#FFF59D", "#A5D6A7", "#90CAF9", "#CE93D8", "#B0BEC5",
  "#F06292", "#FF8A65", "#C0CA33", "#43A047", "#039BE5", "#5E35B1", "#81C784",
  "#880E4F", "#BF360C", "#827717", "#1B5E20", "#01579B", "#311B92", "#37474F",
];

/** 색 버튼(아이콘 + 지금 색 막대) + 팔레트 팝업. */
function colorTool(iconHtml, title, onPick) {
  const wrap = el("span", { class: "c-tool-color-wrap" });
  const button = el("button", {
    type: "button",
    class: "c-tool c-tool-color",
    title,
    "aria-label": title,
  });
  button.innerHTML = `${iconHtml}<span class="c-tool-bar"></span>`;
  const bar = button.querySelector(".c-tool-bar");

  const pop = el("div", { class: "c-color-pop", hidden: true });
  for (const color of COLOR_PALETTE) {
    const swatch = el("button", {
      type: "button",
      class: "c-swatch" + (color === "transparent" ? " c-swatch-none" : ""),
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

  button.addEventListener("click", () => {
    // 열려 있는 다른 팔레트는 닫는다.
    for (const other of document.querySelectorAll(".c-color-pop")) {
      if (other !== pop) other.hidden = true;
    }
    pop.hidden = !pop.hidden;
  });
  document.addEventListener("mousedown", (e) => {
    if (!wrap.contains(e.target)) pop.hidden = true;
  });

  wrap.append(button, pop);
  return wrap;
}

const IMAGE_UPLOAD_ERROR = "이미지 업로드에 실패했습니다. (png, jpeg, webp, gif만 가능합니다)";

/**
 * 이미지 하나를 올리고, 올리는 동안 커서 자리에 자리표시자를 뒀다가 결과로 바꾼다.
 * 툴바 버튼·붙여넣기·드래그앤드롭이 모두 이 함수를 쓴다.
 */
async function insertUploadedImage(textarea, file) {
  const placeholder = `![업로드 중...${Math.random().toString(36).slice(2, 8)}]()`;
  typeInto(textarea, placeholder);
  try {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch("/api/uploads/image", {
      method: "POST",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    const url = data.url || data.path || data.location;
    replacePlaceholder(textarea, placeholder, `![](${url})`);
  } catch {
    replacePlaceholder(textarea, placeholder, "");
    alert(IMAGE_UPLOAD_ERROR);
  }
}

/** 자리표시자를 결과로 바꾼다. 그 사이 사용자가 다른 곳을 고쳤어도 위치를 다시 찾는다. */
function replacePlaceholder(textarea, placeholder, text) {
  const at = textarea.value.indexOf(placeholder);
  if (at === -1) return;
  replaceRange(textarea, at, at + placeholder.length, text);
}

/** 클립보드/드롭 데이터에서 이미지 파일만 골라낸다. */
function imageFilesOf(data) {
  if (!data) return [];
  return Array.from(data.files || []).filter((f) => f.type.startsWith("image/"));
}

/** 버튼을 거치지 않고 붙여넣기·드래그앤드롭으로도 이미지를 넣을 수 있게 한다. */
function enableImageDrop(textarea) {
  textarea.addEventListener("paste", (event) => {
    const files = imageFilesOf(event.clipboardData);
    if (files.length === 0) return;
    event.preventDefault();
    for (const file of files) insertUploadedImage(textarea, file);
  });
  // dragover에서 기본 동작을 막아야 drop 이벤트가 온다.
  textarea.addEventListener("dragover", (event) => {
    if (imageFilesOf(event.dataTransfer).length > 0) event.preventDefault();
  });
  textarea.addEventListener("drop", (event) => {
    const files = imageFilesOf(event.dataTransfer);
    if (files.length === 0) return;
    event.preventDefault();
    for (const file of files) insertUploadedImage(textarea, file);
  });
}

function separator() {
  return el("span", { class: "c-tool-sep" });
}

function buildToolbar(textarea) {
  const fileInput = el("input", {
    type: "file",
    class: "c-tool-file",
    accept: "image/png, image/jpeg, image/webp, image/gif",
  });

  const imageBtn = toolbarButton(TOOLBAR_ICONS.image, "이미지 첨부", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    imageBtn.disabled = true;
    try {
      await insertUploadedImage(textarea, file);
    } finally {
      imageBtn.disabled = false;
      fileInput.value = "";
    }
  });

  enableImageDrop(textarea);

  const headingSelect = el("select", {
    class: "c-tool-select",
    title: "글머리",
    "aria-label": "글머리",
    onchange: (e) => {
      setHeading(textarea, Number(e.target.value));
      e.target.value = "0";
    },
  });
  for (const [value, label] of [
    [0, "본문"], [1, "제목 1"], [2, "제목 2"], [3, "제목 3"],
    [4, "제목 4"], [5, "제목 5"], [6, "제목 6"],
  ]) {
    headingSelect.appendChild(el("option", { value: String(value) }, label));
  }

  function insertLink() {
    const url = window.prompt("링크 주소를 입력하세요", "https://");
    if (url === null) return;
    const href = url.trim();
    if (!href) return;
    wrapSelection(textarea, "[", `](${href})`, "링크 글자");
  }

  return el("div", { class: "c-toolbar" }, [
    toolbarButton(TOOLBAR_ICONS.bold, "굵게", () => wrapSelection(textarea, "**", "**", "굵게")),
    toolbarButton(TOOLBAR_ICONS.italic, "기울임", () => wrapSelection(textarea, "*", "*", "기울임")),
    toolbarButton(TOOLBAR_ICONS.underline, "밑줄", () =>
      toggleWrap(textarea, "<u>", "</u>", /^<u>([\s\S]*)<\/u>$/, "밑줄"),
    ),
    toolbarButton(TOOLBAR_ICONS.strike, "취소선", () => wrapSelection(textarea, "~~", "~~", "취소선")),
    separator(),
    colorTool(TOOLBAR_ICONS.textColor, "글자 색", (color) => {
      if (color === "transparent") {
        toggleWrap(textarea, "", "", /^<span style="color: [^"]*">([\s\S]*)<\/span>$/, "");
        return;
      }
      wrapSelection(textarea, `<span style="color: ${color}">`, "</span>", "글자");
    }),
    colorTool(TOOLBAR_ICONS.highlight, "배경 색", (color) => {
      if (color === "transparent") {
        toggleWrap(textarea, "", "", /^<mark style="background-color: [^"]*">([\s\S]*)<\/mark>$/, "");
        return;
      }
      wrapSelection(textarea, `<mark style="background-color: ${color}">`, "</mark>", "글자");
    }),
    separator(),
    headingSelect,
    separator(),
    toolbarButton(TOOLBAR_ICONS.alignLeft, "왼쪽 정렬", () => setAlign(textarea, "left")),
    toolbarButton(TOOLBAR_ICONS.alignCenter, "가운데 정렬", () => setAlign(textarea, "center")),
    toolbarButton(TOOLBAR_ICONS.alignRight, "오른쪽 정렬", () => setAlign(textarea, "right")),
    toolbarButton(TOOLBAR_ICONS.alignJustify, "양쪽 정렬", () => setAlign(textarea, "justify")),
    separator(),
    toolbarButton(TOOLBAR_ICONS.list, "목록", () => prefixLine(textarea, "- ")),
    toolbarButton(TOOLBAR_ICONS.quote, "인용구", () => prefixLine(textarea, "> ")),
    toolbarButton(TOOLBAR_ICONS.link, "링크", insertLink),
    toolbarButton(TOOLBAR_ICONS.code, "코드 블록", () =>
      wrapSelection(textarea, "```\n", "\n```", "코드"),
    ),
    imageBtn,
    fileInput,
    separator(),
    toolbarButton(TOOLBAR_ICONS.undo, "실행 취소", () => {
      textarea.focus();
      document.execCommand("undo");
    }),
    toolbarButton(TOOLBAR_ICONS.redo, "다시 실행", () => {
      textarea.focus();
      document.execCommand("redo");
    }),
  ]);
}


// ===== 신고 =====

const REPORT_REASONS = [
  { value: "SPAM", label: "스팸·광고" },
  { value: "ABUSE", label: "욕설·비방" },
  { value: "ADULT", label: "음란물·부적절한 내용" },
  { value: "PRIVACY", label: "개인정보 노출" },
  { value: "FALSE_INFO", label: "허위 정보" },
  { value: "ETC", label: "기타" },
];

/** 신고 버튼. 본인 글에는 붙이지 않고, 로그인한 사람에게만 보인다. */
function reportButton(profile, targetType, targetId, authorUsername) {
  if (!profile || profile.username === authorUsername) return null;
  return el(
    "button",
    {
      type: "button",
      class: "link-btn c-report",
      onclick: () => openReportDialog(targetType, targetId),
    },
    "신고",
  );
}

function openReportDialog(targetType, targetId) {
  const label = targetType === "POST" ? "게시글" : "댓글";
  const select = el("select", { class: "field-select" },
    REPORT_REASONS.map((r) => el("option", { value: r.value }, r.label)));
  const detail = el("textarea", {
    class: "field-textarea",
    rows: "4",
    maxlength: "1000",
    placeholder: "어떤 점이 문제인지 적어주세요. (선택)",
  });
  const message = el("p", { class: "c-report-message" });

  const submit = el("button", { type: "button", class: "btn btn-primary btn-sm" }, "신고하기");
  const close = () => overlay.remove();
  const cancel = el("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: close }, "취소");

  submit.addEventListener("click", async () => {
    submit.disabled = true;
    message.textContent = "신고를 보내는 중...";
    message.className = "c-report-message";
    try {
      await authJson("/community/reports", {
        method: "POST",
        body: JSON.stringify({
          targetType,
          targetId,
          reason: select.value,
          detail: detail.value,
        }),
      });
      message.textContent = "신고가 접수되었습니다. 관리자가 확인합니다.";
      message.className = "c-report-message success";
      submit.remove();
      cancel.textContent = "닫기";
    } catch (err) {
      message.textContent = err instanceof Error ? err.message : "신고하지 못했습니다.";
      message.className = "c-report-message error";
      submit.disabled = false;
    }
  });

  const dialog = el("div", { class: "c-report-dialog", role: "dialog", "aria-modal": "true" }, [
    el("h3", {}, `${label} 신고`),
    el("label", { class: "c-report-field" }, [el("span", {}, "신고 종류"), select]),
    el("label", { class: "c-report-field" }, [el("span", {}, "신고 내용"), detail]),
    message,
    el("div", { class: "c-report-actions" }, [submit, cancel]),
  ]);
  const overlay = el("div", {
    class: "c-report-overlay",
    onclick: (e) => { if (e.target === overlay) close(); },
  }, dialog);
  document.body.appendChild(overlay);
  select.focus();
}

// ===== 라우팅 =====

function renderLoginRequired() {
  root.innerHTML = "";
  root.className = "";
  root.appendChild(el("p", { class: "c-error" }, "글쓰기는 로그인 후 이용할 수 있습니다."));
}

function main() {
  // 게이트에 막히면 gate.js가 <main>을 안내 화면으로 갈아끼우므로 이 자리가 사라진다.
  // 그때는 그릴 곳이 없으니 조용히 물러난다(예전엔 여기서 콘솔 오류가 났다).
  if (!root) return;
  // 목록/상세는 백엔드가 비로그인 조회를 허용하므로(OptionalJwtAuthGuard) 항상 렌더링한다.
  // 글쓰기만 로그인이 필요하다.
  window.clubProfileReady.then((profile) => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("new")) {
      if (!profile) renderLoginRequired();
      else renderNew(profile);
    } else if (params.get("post")) renderDetail(profile, params.get("post"));
    else renderList(profile);
  });
}

// ===== 목록 =====

async function renderList(profile) {
  root.innerHTML = "";
  root.className = ""; // 목록은 넓게(OJ 목록과 동일)
  const header = el("div", { class: "c-list-header" }, [
    el("h2", {}, BOARD_TITLE),
    profile ? el("a", { class: "btn btn-primary btn-sm", href: BOARD_PAGE + "?new" }, "글쓰기") : null,
  ]);
  root.appendChild(header);

  let posts;
  try {
    posts = await authJson(`/community/posts?board=${BOARD}`);
  } catch {
    root.appendChild(el("p", { class: "c-error" }, "게시글을 불러오지 못했습니다."));
    return;
  }
  if (posts.length === 0) {
    root.appendChild(el("p", { class: "field-hint" }, "아직 게시글이 없습니다. 첫 글을 남겨보세요!"));
    return;
  }

  const list = el("ul", { class: "c-list" });
  for (const p of posts) {
    const meta = el("div", { class: "c-item-meta" }, [
      authorLink(p.author.username, p.author.avatarVersion, 16),
      el("span", {}, "·"),
      el("span", {}, fmtDate(p.createdAt)),
      ...p.tags.map((t) => el("span", { class: "c-tag" }, "#" + t)),
    ]);
    const titleRow = el("div", { class: "c-item-title" }, [
      typeBadge(p.type),
      el("span", { class: titleClass(p.type) }, p.title),
      p.commentCount > 0 ? el("span", { class: "c-comment-count" }, `[${p.commentCount}]`) : null,
    ]);
    const votes = el("div", { class: "c-item-votes" }, [
      el("span", { class: "c-up" }, `▲ ${p.likeCount}`),
      el("span", { class: "c-down" }, `▼ ${p.dislikeCount}`),
    ]);
    const item = el("li", { class: "c-item" + (p.type === "NOTICE" ? " c-item-notice" : ""), onclick: () => go(`?post=${p.id}`) }, [
      el("div", { class: "c-item-main" }, [titleRow, meta]),
      votes,
    ]);
    list.appendChild(item);
  }
  root.appendChild(list);
}

// ===== 상세 =====

async function renderDetail(profile, postId) {
  root.innerHTML = "";
  root.className = "c-narrow"; // 상세는 좁은 중앙 컬럼(OJ max-w-2xl과 동일)
  let post;
  try {
    post = await authJson(`/community/posts/${postId}`);
  } catch {
    root.appendChild(el("p", { class: "c-error" }, "게시글을 찾을 수 없습니다."));
    return;
  }

  // 백엔드가 실제 존재하는 멘션 대상만 추려 내려준다.
  mentionUsers = new Map((post.mentions || []).map((m) => [m.username, m.avatarVersion]));

  root.appendChild(el("a", { class: "c-back", href: BOARD_PAGE }, "← " + BOARD_TITLE));

  const canManage = profile && (profile.username === post.author.username || profile.role === "ADMIN");
  const titleRow = el("h2", { class: titleClass(post.type) + " c-detail-title" }, [typeBadge(post.type), document.createTextNode(post.title)]);

  const metaRight = canManage
    ? el("button", { type: "button", class: "link-btn", onclick: () => onDeletePost(post.id) }, "삭제")
    : reportButton(profile, "POST", post.id, post.author.username);
  const meta = el("div", { class: "c-detail-meta" }, [
    el("div", { class: "c-item-meta" }, [
      authorLink(post.author.username, post.author.avatarVersion, 20, "c-author"),
      el("span", {}, "·"),
      el("span", {}, fmtDateTime(post.createdAt)),
      ...post.tags.map((t) => el("span", { class: "c-tag" }, "#" + t)),
    ]),
    metaRight,
  ]);

  const body = window.renderMarkdown ? window.renderMarkdown(post.content) : el("div", {}, post.content);
  body.classList.add("c-body");
  applyMentions(body);

  const postActions = el("div", { class: "c-detail-votes" });
  let voteSummary = { likeCount: post.likeCount, dislikeCount: post.dislikeCount, myVote: post.myVote };
  function drawActions() {
    postActions.innerHTML = "";
    postActions.appendChild(voteButtons(voteSummary, onVotePost, "md"));
  }
  async function onVotePost(value) {
    if (!profile) { alert("로그인 후 이용할 수 있습니다."); return; }
    try {
      voteSummary = await authJson(`/community/posts/${post.id}/vote`, { method: "POST", body: JSON.stringify({ value }) });
      drawActions();
    } catch {
      /* 무시 */
    }
  }
  drawActions();

  root.append(titleRow, meta, body, postActions);
  root.appendChild(renderComments(profile, post));
}

async function onDeletePost(id) {
  if (!window.confirm("이 게시글을 삭제할까요? 되돌릴 수 없습니다.")) return;
  try {
    await authJson(`/community/posts/${id}`, { method: "DELETE" });
    go("");
  } catch (err) {
    alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
  }
}

// ===== 댓글 =====

function renderComments(profile, post) {
  const section = el("div", { class: "c-comments" });
  let sort = "popular"; // 인기순(기본) / old(날짜순) / new(최신순)
  let comments = post.comments.slice();

  const header = el("div", { class: "c-comments-header" });
  const listWrap = el("div", {});

  function score(c) {
    return c.likeCount - c.dislikeCount;
  }
  function sorted(items) {
    const arr = items.slice();
    if (sort === "popular") arr.sort((a, b) => score(b) - score(a) || new Date(a.createdAt) - new Date(b.createdAt));
    else if (sort === "old") arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    else arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return arr;
  }

  async function onVoteComment(commentId, value) {
    if (!profile) { alert("로그인 후 이용할 수 있습니다."); return; }
    try {
      const summary = await authJson(`/community/comments/${commentId}/vote`, { method: "POST", body: JSON.stringify({ value }) });
      comments = comments.map((c) => (c.id === commentId ? { ...c, ...summary } : c));
      draw();
    } catch {
      /* 무시 */
    }
  }

  async function reload() {
    try {
      const fresh = await authJson(`/community/posts/${post.id}`);
      comments = fresh.comments;
      draw();
    } catch {
      /* 무시 */
    }
  }

  async function onDeleteComment(id) {
    if (!window.confirm("이 댓글을 삭제할까요?")) return;
    await authJson(`/community/comments/${id}`, { method: "DELETE" });
    reload();
  }

  let replyTo = null;
  const textarea = el("textarea", { class: "field-textarea", rows: "3", placeholder: "댓글을 남겨보세요" });
  const noticeP = el("p", { class: "c-error" });

  async function submitComment() {
    const content = textarea.value.trim();
    if (!content) return;
    noticeP.textContent = "";
    try {
      await authJson(`/community/posts/${post.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content, parentId: replyTo || undefined }),
      });
      textarea.value = "";
      replyTo = null;
      reload();
    } catch (err) {
      noticeP.textContent = err instanceof Error ? err.message : "등록에 실패했습니다.";
    }
  }

  function commentRow(c, isReply) {
    const canManage = profile && (profile.username === c.user.username || profile.role === "ADMIN");
    const actions = el("div", { class: "c-comment-actions" }, [
      voteButtons(c, (v) => onVoteComment(c.id, v)),
      !isReply && profile ? el("button", { type: "button", class: "link-btn", onclick: () => { replyTo = c.id; textarea.placeholder = "답글 내용"; textarea.focus(); } }, "답글") : null,
      canManage ? el("button", { type: "button", class: "link-btn c-del", onclick: () => onDeleteComment(c.id) }, "삭제") : null,
      // 댓글·답글 모두 신고할 수 있다(본인 글 제외).
      canManage ? null : reportButton(profile, "COMMENT", c.id, c.user.username),
    ]);
    return el("div", {}, [
      el("div", { class: "c-comment-top" }, [
        authorLink(c.user.username, c.user.avatarVersion, 18, "c-comment-author"),
        el("span", { class: "c-comment-date" }, fmtDateTime(c.createdAt)),
      ]),
      (() => {
        // 댓글·답글도 글쓰기와 같은 마크다운으로 그린다(이미지 포함).
        const body = window.renderMarkdown
          ? window.renderMarkdown(c.content)
          : el("p", { class: "c-comment-body" }, c.content);
        body.classList.add("c-comment-body");
        applyMentions(body);
        return body;
      })(),
      actions,
    ]);
  }

  function draw() {
    // 헤더(개수 + 정렬)
    header.innerHTML = "";
    header.appendChild(el("h3", {}, `댓글 (${comments.length})`));
    if (comments.length > 0) {
      const sortBtns = el("div", { class: "c-sort" });
      for (const [key, label] of [["popular", "인기순"], ["old", "날짜순"], ["new", "최신순"]]) {
        sortBtns.appendChild(
          el("button", { type: "button", class: "c-sort-btn" + (sort === key ? " active" : ""), onclick: () => { sort = key; draw(); } }, label),
        );
      }
      header.appendChild(sortBtns);
    }

    // 목록
    listWrap.innerHTML = "";
    const top = sorted(comments.filter((c) => !c.parentId));
    if (top.length === 0) {
      listWrap.appendChild(el("p", { class: "field-hint" }, "아직 댓글이 없습니다."));
    }
    for (const c of top) {
      const replies = comments.filter((r) => r.parentId === c.id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const li = el("div", { class: "c-comment" }, [commentRow(c, false)]);
      if (replies.length) {
        const replyWrap = el("div", { class: "c-replies" });
        for (const r of replies) replyWrap.appendChild(el("div", { class: "c-reply" }, [commentRow(r, true)]));
        li.appendChild(replyWrap);
      }
      listWrap.appendChild(li);
    }
  }

  draw();
  section.append(header, listWrap);

  const form = profile
    ? el("div", { class: "c-comment-form" }, [
        // 글쓰기와 같은 마크다운 툴바(이미지 첨부·붙여넣기·드래그앤드롭 포함).
        buildToolbar(textarea),
        textarea,
        noticeP,
        el("button", { type: "button", class: "btn btn-primary btn-sm", onclick: submitComment }, "등록"),
      ])
    : el("p", { class: "field-hint" }, "댓글을 남기려면 로그인해주세요.");
  section.appendChild(form);
  return section;
}

// ===== 글쓰기 =====

async function renderNew(profile) {
  root.innerHTML = "";
  root.className = "c-narrow"; // 글쓰기도 좁은 중앙 컬럼(OJ와 동일)
  root.appendChild(el("h2", {}, "글쓰기"));

  const isAdmin = profile.role === "ADMIN";
  let type = "NORMAL";
  const selectedTags = [];

  const titleInput = el("input", { class: "field-input", maxlength: "200" });

  // 유형: 업데이트 로그(누구나) / 공지(어드민만). 하나만 선택 가능.
  const updateCb = el("input", { type: "checkbox" });
  const noticeCb = el("input", { type: "checkbox" });
  function syncType(which) {
    if (which === "UPDATE_LOG") {
      type = updateCb.checked ? "UPDATE_LOG" : "NORMAL";
      if (updateCb.checked) noticeCb.checked = false;
    } else {
      type = noticeCb.checked ? "NOTICE" : "NORMAL";
      if (noticeCb.checked) updateCb.checked = false;
    }
  }
  updateCb.addEventListener("change", () => syncType("UPDATE_LOG"));
  noticeCb.addEventListener("change", () => syncType("NOTICE"));
  const typeRow = el("div", { class: "c-type-row" }, [
    el("label", { class: "c-type-opt" }, [updateCb, el("span", { class: "c-title-update" }, "업데이트 로그")]),
    isAdmin ? el("label", { class: "c-type-opt" }, [noticeCb, el("span", { class: "c-title-notice" }, "공지")]) : null,
  ]);

  // 태그 선택기 (board=HOME 전용 풀)
  const tagWrap = el("div", { class: "c-tag-picker" });
  let tagOptions = [];
  try {
    tagOptions = (await authJson(`/community/tags?board=${BOARD}`)).map((t) => t.name);
  } catch {
    tagOptions = [];
  }
  const tagChips = el("div", { class: "c-tag-chips" });
  const newTagInput = el("input", { class: "c-tag-input", maxlength: "20", placeholder: "새 태그" });
  function drawTags() {
    tagChips.innerHTML = "";
    for (const name of tagOptions) {
      const on = selectedTags.includes(name);
      tagChips.appendChild(
        el("button", { type: "button", class: "c-chip" + (on ? " active" : ""), onclick: () => {
          const i = selectedTags.indexOf(name);
          if (i >= 0) selectedTags.splice(i, 1); else selectedTags.push(name);
          drawTags();
        } }, name),
      );
    }
    tagChips.appendChild(newTagInput);
    tagChips.appendChild(el("button", { type: "button", class: "c-chip c-chip-add", onclick: addTag }, "+ 추가"));
  }
  async function addTag() {
    const name = newTagInput.value.trim();
    if (!name) return;
    try {
      const created = await authJson("/community/tags", { method: "POST", body: JSON.stringify({ board: BOARD, name }) });
      if (!tagOptions.includes(created.name)) tagOptions.push(created.name);
      tagOptions.sort();
      if (!selectedTags.includes(created.name)) selectedTags.push(created.name);
      newTagInput.value = "";
      drawTags();
    } catch (err) {
      alert(err instanceof Error ? err.message : "태그 추가에 실패했습니다.");
    }
  }
  newTagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addTag(); }
  });
  drawTags();
  tagWrap.append(el("span", { class: "field-label" }, "태그 (복수 선택 가능)"), tagChips);

  // 내용 + 미리보기
  const contentArea = el("textarea", { class: "field-textarea c-content", rows: "12" });
  const preview = el("div", { class: "c-body markdown-body", style: "display:none" });
  let previewing = false;
  const previewBtn = el("button", { type: "button", class: "link-btn", onclick: async () => {
    previewing = !previewing;
    if (previewing) {
      preview.innerHTML = "";
      const rendered = window.renderMarkdown ? window.renderMarkdown(contentArea.value || "내용이 없습니다.") : el("div", {}, contentArea.value);
      preview.appendChild(rendered);
      // 저장 전이라 서버가 본문을 모르므로, 초안을 보내 실제 존재하는 멘션 대상을 받아 칩으로 그린다.
      try {
        const found = await authJson("/community/mentions/resolve", {
          method: "POST",
          body: JSON.stringify({ content: contentArea.value }),
        });
        mentionUsers = new Map(found.map((m) => [m.username, m.avatarVersion]));
        applyMentions(rendered);
      } catch {
        // 확인에 실패하면 멘션은 원문 그대로 둔다.
      }
      preview.style.display = "";
      contentArea.style.display = "none";
      previewBtn.textContent = "편집";
    } else {
      preview.style.display = "none";
      contentArea.style.display = "";
      previewBtn.textContent = "미리보기";
    }
  } }, "미리보기");
  const contentHead = el("div", { class: "c-content-head" }, [el("span", { class: "field-label" }, "내용"), previewBtn]);

  const errorP = el("p", { class: "c-error" });
  const submitBtn = el("button", { type: "button", class: "btn btn-primary btn-sm" }, "등록");
  submitBtn.addEventListener("click", async () => {
    const title = titleInput.value.trim();
    const content = contentArea.value.trim();
    if (!title || !content) {
      errorP.textContent = "제목과 내용을 입력해주세요.";
      return;
    }
    submitBtn.disabled = true;
    errorP.textContent = "";
    try {
      const created = await authJson("/community/posts", {
        method: "POST",
        body: JSON.stringify({ board: BOARD, title, content, type, tags: selectedTags }),
      });
      go(`?post=${created.id}`);
    } catch (err) {
      errorP.textContent = err instanceof Error ? err.message : "게시글 등록에 실패했습니다.";
      submitBtn.disabled = false;
    }
  });

  root.append(
    el("div", { class: "c-form" }, [
      el("label", { class: "field-label" }, "제목"),
      titleInput,
      el("span", { class: "field-label" }, "게시글 유형"),
      typeRow,
      tagWrap,
      contentHead,
      buildToolbar(contentArea),
      contentArea,
      preview,
      errorP,
      el("div", { class: "c-form-actions" }, [
        submitBtn,
        el("a", { class: "btn btn-ghost btn-sm", href: BOARD_PAGE }, "취소"),
      ]),
    ]),
  );
}

main();
