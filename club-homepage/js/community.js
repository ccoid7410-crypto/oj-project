// 두루누리 홈페이지 커뮤니티 (board=HOME). OJ 커뮤니티와 같은 백엔드를 쓰되 board로
// 분리되어 글/태그를 공유하지 않는다. 한 페이지(community.html)에서 URL 쿼리로 화면을 전환한다:
//   (없음)      → 게시글 목록
//   ?post=<id>  → 게시글 상세
//   ?new        → 글쓰기

const BOARD = "HOME";
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
  window.location.href = "community.html" + query;
}

// ===== 라우팅 =====

function main() {
  window.clubProfileReady.then((profile) => {
    if (!profile) return; // gate.js가 로그인/부원 안내 화면을 이미 띄움
    const params = new URLSearchParams(window.location.search);
    if (params.has("new")) renderNew(profile);
    else if (params.get("post")) renderDetail(profile, params.get("post"));
    else renderList(profile);
  });
}

// ===== 목록 =====

async function renderList(profile) {
  root.innerHTML = "";
  root.className = ""; // 목록은 넓게(OJ 목록과 동일)
  const header = el("div", { class: "c-list-header" }, [
    el("h2", {}, "커뮤니티"),
    el("a", { class: "btn btn-primary btn-sm", href: "community.html?new" }, "글쓰기"),
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
      avatarNode(p.author.username, p.author.avatarVersion, 16),
      el("span", {}, p.author.username),
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

  root.appendChild(el("a", { class: "c-back", href: "community.html" }, "← 커뮤니티"));

  const canManage = profile && (profile.username === post.author.username || profile.role === "ADMIN");
  const titleRow = el("h2", { class: titleClass(post.type) + " c-detail-title" }, [typeBadge(post.type), document.createTextNode(post.title)]);

  const metaRight = canManage
    ? el("button", { type: "button", class: "link-btn", onclick: () => onDeletePost(post.id) }, "삭제")
    : null;
  const meta = el("div", { class: "c-detail-meta" }, [
    el("div", { class: "c-item-meta" }, [
      avatarNode(post.author.username, post.author.avatarVersion, 20),
      el("span", { class: "c-author" }, post.author.username),
      el("span", {}, "·"),
      el("span", {}, fmtDateTime(post.createdAt)),
      ...post.tags.map((t) => el("span", { class: "c-tag" }, "#" + t)),
    ]),
    metaRight,
  ]);

  const body = window.renderMarkdown ? window.renderMarkdown(post.content) : el("div", {}, post.content);
  body.classList.add("c-body");

  const postActions = el("div", { class: "c-detail-votes" });
  let voteSummary = { likeCount: post.likeCount, dislikeCount: post.dislikeCount, myVote: post.myVote };
  function drawActions() {
    postActions.innerHTML = "";
    postActions.appendChild(voteButtons(voteSummary, onVotePost, "md"));
  }
  async function onVotePost(value) {
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
      !isReply ? el("button", { type: "button", class: "link-btn", onclick: () => { replyTo = c.id; textarea.placeholder = "답글 내용"; textarea.focus(); } }, "답글") : null,
      canManage ? el("button", { type: "button", class: "link-btn c-del", onclick: () => onDeleteComment(c.id) }, "삭제") : null,
    ]);
    return el("div", {}, [
      el("div", { class: "c-comment-top" }, [
        el("span", { class: "c-comment-author" }, [avatarNode(c.user.username, c.user.avatarVersion, 18), document.createTextNode(" " + c.user.username)]),
        el("span", { class: "c-comment-date" }, fmtDateTime(c.createdAt)),
      ]),
      el("p", { class: "c-comment-body" }, c.content),
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

  // 작성 폼 (부원 전용 페이지라 항상 로그인 상태)
  const form = el("div", { class: "c-comment-form" }, [
    textarea,
    noticeP,
    el("button", { type: "button", class: "btn btn-primary btn-sm", onclick: submitComment }, "등록"),
  ]);
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
  const previewBtn = el("button", { type: "button", class: "link-btn", onclick: () => {
    previewing = !previewing;
    if (previewing) {
      preview.innerHTML = "";
      const rendered = window.renderMarkdown ? window.renderMarkdown(contentArea.value || "내용이 없습니다.") : el("div", {}, contentArea.value);
      preview.appendChild(rendered);
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
      contentArea,
      preview,
      errorP,
      el("div", { class: "c-form-actions" }, [
        submitBtn,
        el("a", { class: "btn btn-ghost btn-sm", href: "community.html" }, "취소"),
      ]),
    ]),
  );
}

main();
