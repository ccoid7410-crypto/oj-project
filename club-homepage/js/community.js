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

// ===== 공용 편집기 =====
// 편집기 본체는 js/markdown-editor.js 하나뿐이다(OJ도 같은 파일을 쓴다).
// 여기서는 이 사이트에서만 다른 두 가지(미리보기 그리는 법, 이미지 올리는 법)만 넘겨준다.

/** 미리보기: 마크다운으로 그린 뒤 실제로 존재하는 계정만 멘션 칩으로 바꾼다. */
async function renderEditorPreview(content, container) {
  const rendered = window.renderMarkdown
    ? window.renderMarkdown(content || "내용이 없습니다.")
    : el("div", {}, content);
  container.appendChild(rendered);
  if (!content.trim()) return;
  // 저장 전이라 서버가 본문을 모르므로, 초안을 보내 실제 존재하는 멘션 대상을 받아 온다.
  try {
    const found = await authJson("/community/mentions/resolve", {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    mentionUsers = new Map(found.map((m) => [m.username, m.avatarVersion]));
    applyMentions(rendered);
  } catch {
    // 확인에 실패하면 멘션은 원문 그대로 둔다.
  }
}

/** 이미지 업로드. 공용 편집기가 첨부·붙여넣기·드래그앤드롭에서 모두 이 함수를 쓴다. */
async function uploadEditorImage(file) {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch("/api/uploads/image", {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  if (!res.ok) throw new Error("업로드 실패");
  const data = await res.json();
  return data.url || data.path || data.location;
}

/** 이 사이트용 기본값을 채운 편집기를 만든다. */
function createEditor(mount, options) {
  return window.DurunuriEditor.createMarkdownEditor({
    mount,
    renderPreview: renderEditorPreview,
    uploadImage: uploadEditorImage,
    ...options,
  });
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
  const editorMount = el("div", {});
  const editor = createEditor(editorMount, { placeholder: "댓글을 남겨보세요", compact: true });
  const noticeP = el("p", { class: "c-error" });

  async function submitComment() {
    const content = editor.getValue().trim();
    if (!content) return;
    noticeP.textContent = "";
    try {
      await authJson(`/community/posts/${post.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content, parentId: replyTo || undefined }),
      });
      editor.setValue("");
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
      !isReply && profile ? el("button", { type: "button", class: "link-btn", onclick: () => { replyTo = c.id; editor.textarea.placeholder = "답글 내용"; editor.textarea.focus(); } }, "답글") : null,
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
        editorMount,
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

  // 내용(원문 편집 + 미리보기)은 공용 편집기가 통째로 맡는다.
  const editorMount = el("div", {});
  const editor = createEditor(editorMount, { placeholder: "내용을 입력하세요" });

  const errorP = el("p", { class: "c-error" });
  const submitBtn = el("button", { type: "button", class: "btn btn-primary btn-sm" }, "등록");
  submitBtn.addEventListener("click", async () => {
    const title = titleInput.value.trim();
    const content = editor.getValue().trim();
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
      el("span", { class: "field-label" }, "내용"),
      editorMount,
      errorP,
      el("div", { class: "c-form-actions" }, [
        submitBtn,
        el("a", { class: "btn btn-ghost btn-sm", href: BOARD_PAGE }, "취소"),
      ]),
    ]),
  );
}

main();
