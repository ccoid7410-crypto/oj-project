// 마이페이지 = OJ 사용자 프로필 페이지와 동일한 내용을 이 페이지 안에서 직접 그린다.
// (다른 페이지로 링크만 걸어두는 게 아니라 콘텐츠 자체를 그대로 재현한다.)

const token = localStorage.getItem("oj_token");

function authFetch(path, options = {}) {
  const hasBody = options.body !== undefined;
  return fetch(`/api${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
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

/** 아주 얇은 DOM 빌더. class/on이벤트/속성을 한 번에 받는다. */
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

// ===== 이미지 업로드 변환 (OJ 프론트의 lib/avatar.ts와 동일 규칙) =====

async function avatarPayloadFromFile(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const edge = Math.min(256, bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = edge;
    canvas.height = edge;
    const ctx = canvas.getContext("2d");
    const srcEdge = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - srcEdge) / 2;
    const sy = (bitmap.height - srcEdge) / 2;
    ctx.drawImage(bitmap, sx, sy, srcEdge, srcEdge, 0, 0, edge, edge);
    const dataUrl = canvas.toDataURL("image/png");
    return { mime: "image/png", data: dataUrl.split(",", 2)[1] };
  } finally {
    bitmap.close();
  }
}

async function bannerPayloadFromFile(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { mime: "image/jpeg", data: dataUrl.split(",", 2)[1] };
  } finally {
    bitmap.close();
  }
}

const ROLE_LABEL = { ADMIN: "관리자", MEMBER: "부원", USER: "일반 회원" };

const root = document.getElementById("account-info");

function avatarNode(username, avatarVersion, size) {
  const span = el("span", { class: "profile-avatar", style: `width:${size}px;height:${size}px` });
  if (avatarVersion) {
    span.appendChild(
      el("img", { src: `/api/users/${encodeURIComponent(username)}/avatar?v=${avatarVersion}`, alt: "" }),
    );
  }
  return span;
}

/** 상태 메시지(성공/실패) 표시용 <p> 두 개를 만든다. 어디에 붙일지는 호출부가 정한다. */
function fieldNotice() {
  const notice = el("p", { class: "field-notice" });
  const error = el("p", { class: "field-error" });
  return {
    nodes: [notice, error],
    ok(msg) {
      notice.textContent = msg;
      error.textContent = "";
    },
    fail(err) {
      error.textContent = err instanceof Error ? err.message : "요청에 실패했습니다.";
      notice.textContent = "";
    },
  };
}

async function main() {
  window.clubProfileReady.then((clubProfile) => {
    if (!clubProfile) return; // gate.js가 이미 로그인/부원 안내 화면을 띄운 상태
    render(clubProfile.username);
  });
}

async function render(username) {
  root.innerHTML = "";
  let me, publicProfile;
  try {
    [me, publicProfile] = await Promise.all([
      authJson("/users/me"),
      authJson(`/users/${encodeURIComponent(username)}`),
    ]);
  } catch {
    root.appendChild(el("p", { class: "error" }, "프로필을 불러오지 못했습니다."));
    return;
  }

  const wrap = el("div", { class: "profile-page" });

  // ---- 배너 ----
  if (publicProfile.bannerVersion) {
    wrap.appendChild(
      el("img", {
        class: "profile-banner",
        src: `/api/users/${encodeURIComponent(username)}/banner?v=${publicProfile.bannerVersion}`,
        alt: "배너",
      }),
    );
  }

  // ---- 헤더: 아바타 + 아이디 + 권한 + 사이트 ----
  const header = el("div", { class: "profile-header" }, [
    avatarNode(username, publicProfile.avatarVersion, 56),
    el("div", {}, [
      el("div", { class: "profile-title-row" }, [
        el("h1", {}, username),
        publicProfile.role === "ADMIN" ? el("span", { class: "role-badge" }, "ADMIN") : null,
      ]),
      publicProfile.websites?.length
        ? el(
            "div",
            { class: "profile-websites" },
            publicProfile.websites.map((site) => el("a", { href: site, target: "_blank", rel: "noopener noreferrer" }, site)),
          )
        : null,
    ]),
  ]);
  wrap.appendChild(header);

  if (publicProfile.bio) {
    wrap.appendChild(el("p", { class: "profile-bio" }, publicProfile.bio));
  }

  // ---- 통계 ----
  wrap.appendChild(
    el("div", { class: "profile-stats" }, [
      el("div", { class: "profile-stat" }, [el("div", { class: "stat-label" }, "레이팅"), el("div", { class: "stat-value stat-brand" }, String(publicProfile.rating))]),
      el("div", { class: "profile-stat" }, [el("div", { class: "stat-label" }, "랭킹"), el("div", { class: "stat-value" }, publicProfile.rank ? `#${publicProfile.rank}` : "-")]),
      el("div", { class: "profile-stat" }, [el("div", { class: "stat-label" }, "해결한 문제"), el("div", { class: "stat-value" }, String(publicProfile.solvedCount))]),
    ]),
  );

  // ---- 프로필 설정(이미지/배너/소개/사이트) ----
  wrap.appendChild(renderProfileSettings(username, me, publicProfile));

  // ---- 계정 정보(기수/권한/가입일) + 색상 설정 ----
  wrap.appendChild(renderAccountInfo(me));

  // ---- 이름 ----
  wrap.appendChild(renderNameSection(me));

  // ---- 학번 ----
  const studentIdSection = el("div", { class: "settings-card" }, el("p", { class: "loading" }, "불러오는 중..."));
  wrap.appendChild(studentIdSection);
  renderStudentIdSection(me).then((node) => studentIdSection.replaceWith(node));

  // ---- 기본 제출 언어 ----
  wrap.appendChild(renderPreferredLanguageSection(me));

  // ---- 회원 탈퇴 ----
  if (me.role !== "ADMIN") {
    wrap.appendChild(renderDeleteAccountSection());
  }

  // ---- 푼 문제 ----
  wrap.appendChild(el("h2", { class: "solved-heading" }, "푼 문제 (난이도 높은 순)"));
  if (!publicProfile.solvedProblems?.length) {
    wrap.appendChild(el("p", { class: "empty" }, "아직 푼 문제가 없습니다."));
  } else {
    wrap.appendChild(
      el(
        "ul",
        { class: "solved-list" },
        publicProfile.solvedProblems.map((p) =>
          el("li", {}, el("a", { href: `/problems/${p.slug}` }, [`#${p.displayId} `, p.title])),
        ),
      ),
    );
  }

  root.appendChild(wrap);
}

function renderProfileSettings(username, me, publicProfile) {
  const card = el("div", { class: "settings-card" }, el("p", { class: "settings-title" }, "프로필 설정"));

  const avatarRow = el("div", { class: "settings-avatar-row" }, avatarNode(username, publicProfile.avatarVersion, 48));
  const avatarInput = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp", class: "hidden-file-input" });
  const bannerInput = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp", class: "hidden-file-input" });
  const imageNotice = fieldNotice();

  const avatarLabel = el("label", { class: "btn btn-ghost btn-sm" }, ["이미지 업로드", avatarInput]);
  avatarInput.addEventListener("change", async () => {
    const file = avatarInput.files?.[0];
    avatarInput.value = "";
    if (!file) return;
    try {
      const payload = await avatarPayloadFromFile(file);
      await authJson("/users/me/avatar", { method: "PUT", body: JSON.stringify(payload) });
      imageNotice.ok("프로필 이미지가 변경됐습니다.");
      render(username);
    } catch (err) {
      imageNotice.fail(err);
    }
  });
  avatarRow.appendChild(avatarLabel);

  if (publicProfile.avatarVersion) {
    avatarRow.appendChild(
      el("button", { type: "button", class: "link-btn", onclick: async () => {
        try {
          await authJson("/users/me/avatar", { method: "DELETE" });
          imageNotice.ok("기본 이미지로 되돌렸습니다.");
          render(username);
        } catch (err) {
          imageNotice.fail(err);
        }
      } }, "기본 이미지로"),
    );
  }

  avatarRow.appendChild(el("span", { class: "settings-divider" }));
  avatarRow.appendChild(el("label", { class: "btn btn-ghost btn-sm" }, ["배너 업로드", bannerInput]));
  bannerInput.addEventListener("change", async () => {
    const file = bannerInput.files?.[0];
    bannerInput.value = "";
    if (!file) return;
    try {
      const payload = await bannerPayloadFromFile(file);
      await authJson("/users/me/banner", { method: "PUT", body: JSON.stringify(payload) });
      imageNotice.ok("배너가 변경됐습니다.");
      render(username);
    } catch (err) {
      imageNotice.fail(err);
    }
  });
  if (publicProfile.bannerVersion) {
    avatarRow.appendChild(
      el("button", { type: "button", class: "link-btn", onclick: async () => {
        try {
          await authJson("/users/me/banner", { method: "DELETE" });
          imageNotice.ok("배너를 제거했습니다.");
          render(username);
        } catch (err) {
          imageNotice.fail(err);
        }
      } }, "배너 제거"),
    );
  }
  card.appendChild(avatarRow);
  card.append(...imageNotice.nodes);

  const bioLabel = el("label", { class: "field-label" }, "소개");
  const bioTextarea = el("textarea", { class: "field-textarea", maxlength: "300", rows: "3", placeholder: "자기소개를 적어보세요 (300자 이내)" });
  bioTextarea.value = me.bio ?? "";
  card.appendChild(el("div", { class: "field" }, [bioLabel, bioTextarea]));

  const websiteFields = el("div", { class: "website-fields" });
  const websiteValues = publicProfile.websites?.length ? [...publicProfile.websites] : [""];
  function renderWebsiteInputs() {
    websiteFields.innerHTML = "";
    websiteValues.forEach((value, i) => {
      const input = el("input", { class: "field-input", maxlength: "200", placeholder: "https://example.com" });
      input.value = value;
      input.addEventListener("input", () => (websiteValues[i] = input.value));
      const removeBtn = el("button", { type: "button", class: "link-btn" }, "삭제");
      removeBtn.addEventListener("click", () => {
        websiteValues.splice(i, 1);
        renderWebsiteInputs();
      });
      websiteFields.appendChild(el("div", { class: "website-field-row" }, [input, removeBtn]));
    });
  }
  renderWebsiteInputs();
  const addWebsiteBtn = el("button", { type: "button", class: "btn btn-ghost btn-sm" }, "+ 사이트 추가");
  addWebsiteBtn.addEventListener("click", () => {
    if (websiteValues.length >= 5) return;
    websiteValues.push("");
    renderWebsiteInputs();
  });
  card.appendChild(el("div", { class: "field" }, [el("span", { class: "field-label" }, "사이트 (최대 5개)"), websiteFields, addWebsiteBtn]));

  const saveNotice = fieldNotice();
  const saveBtn = el("button", { type: "button", class: "btn btn-primary btn-sm" }, "저장");
  saveBtn.addEventListener("click", async () => {
    try {
      await authJson("/users/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          bio: bioTextarea.value,
          websites: websiteValues.map((w) => w.trim()).filter(Boolean),
        }),
      });
      saveNotice.ok("프로필이 저장됐습니다.");
    } catch (err) {
      saveNotice.fail(err);
    }
  });
  card.appendChild(saveBtn);
  card.append(...saveNotice.nodes);

  return card;
}

function renderAccountInfo(me) {
  const card = el("div", { class: "settings-card" }, el("p", { class: "settings-title" }, "계정 정보"));
  card.appendChild(
    el("dl", { class: "account-info-grid" }, [
      el("div", {}, [el("dt", {}, "기수"), el("dd", {}, me.generation ? `${me.generation}기` : "-")]),
      el("div", {}, [el("dt", {}, "권한"), el("dd", {}, ROLE_LABEL[me.role] ?? me.role)]),
      el("div", {}, [el("dt", {}, "가입일"), el("dd", {}, me.createdAt ? new Date(me.createdAt).toLocaleDateString("ko-KR") : "-")]),
    ]),
  );
  card.appendChild(el("p", { class: "field-label" }, "색상 설정"));
  card.appendChild(renderThemeButtons());
  return card;
}

function renderThemeButtons() {
  const group = el("div", { class: "theme-buttons" });
  function refresh() {
    for (const btn of group.children) {
      btn.classList.toggle("active", btn.dataset.value === window.ojTheme.stored());
    }
  }
  for (const [value, text] of [["system", "시스템"], ["light", "라이트"], ["dark", "다크"]]) {
    const btn = el("button", { type: "button", class: "theme-btn" }, text);
    btn.dataset.value = value;
    btn.addEventListener("click", () => {
      window.ojTheme.set(value);
      refresh();
      authFetch("/users/me/theme", { method: "PATCH", body: JSON.stringify({ theme: value }) }).catch(() => {});
    });
    group.appendChild(btn);
  }
  refresh();
  return group;
}

function renderNameSection(me) {
  const card = el("div", { class: "settings-card" }, el("p", { class: "settings-title" }, "이름 (실명)"));
  if (!me.name) card.appendChild(el("p", { class: "field-hint" }, "아직 등록된 이름이 없습니다."));
  const input = el("input", { class: "field-input field-input-sm", maxlength: "30", placeholder: "예: 김철수" });
  input.value = me.name ?? "";
  const notice = fieldNotice();
  const btn = el("button", { type: "button", class: "btn btn-primary btn-sm" }, "저장");
  btn.addEventListener("click", async () => {
    if (!input.value.trim()) return;
    try {
      await authJson("/users/me/name", { method: "PATCH", body: JSON.stringify({ name: input.value.trim() }) });
      notice.ok("이름이 저장됐습니다.");
    } catch (err) {
      notice.fail(err);
    }
  });
  card.appendChild(el("div", { class: "inline-form" }, [input, btn]));
  card.append(...notice.nodes);
  return card;
}

async function renderStudentIdSection(me) {
  const card = el("div", { class: "settings-card" }, el("p", { class: "settings-title" }, "학번"));
  let win = { startsAt: null, endsAt: null, isOpen: false };
  try {
    win = await authJson("/users/me/student-id-window");
  } catch {
    // 창 정보를 못 가져와도 학번 카드 자체는 계속 보여준다.
  }
  const hasStudentId = !!me.studentId;
  const canEdit = !hasStudentId || win.isOpen;

  if (!hasStudentId) {
    card.appendChild(el("p", { class: "field-hint" }, "아직 등록된 학번이 없습니다. 최초 등록은 언제든 가능합니다."));
  } else if (!win.isOpen) {
    const extra = win.startsAt && win.endsAt
      ? ` (다음 수정 가능 기간: ${new Date(win.startsAt).toLocaleString("ko-KR")} ~ ${new Date(win.endsAt).toLocaleString("ko-KR")})`
      : "";
    card.appendChild(el("p", { class: "field-hint" }, `현재 학번: ${me.studentId} · 지금은 수정 기간이 아닙니다.${extra}`));
  } else {
    card.appendChild(el("p", { class: "field-hint field-hint-open" }, "지금은 학번 수정 기간입니다."));
  }

  if (canEdit) {
    const input = el("input", { class: "field-input field-input-sm", placeholder: "예: 20240001" });
    input.value = me.studentId ?? "";
    const notice = fieldNotice();
    const btn = el("button", { type: "button", class: "btn btn-primary btn-sm" }, "저장");
    btn.addEventListener("click", async () => {
      if (!input.value.trim()) return;
      try {
        await authJson("/users/me/student-id", { method: "PATCH", body: JSON.stringify({ studentId: input.value.trim() }) });
        notice.ok("학번이 저장됐습니다.");
      } catch (err) {
        notice.fail(err);
      }
    });
    card.appendChild(el("div", { class: "inline-form" }, [input, btn]));
    card.append(...notice.nodes);
  }
  return card;
}

const LANGUAGE_OPTIONS = [
  ["CPP", "C++17"],
  ["C", "C"],
  ["JAVA", "Java (class Main)"],
  ["PYTHON3", "Python 3"],
  ["JAVASCRIPT", "Node.js"],
  ["GO", "Go"],
];

function renderPreferredLanguageSection(me) {
  const card = el("div", { class: "settings-card" }, el("p", { class: "settings-title" }, "기본 제출 언어"));
  card.appendChild(el("p", { class: "field-hint" }, "문제 페이지에서 이 언어가 자동으로 선택됩니다."));
  const select = el("select", { class: "field-select" }, [
    el("option", { value: "", disabled: "true" }, "언어 선택"),
    ...LANGUAGE_OPTIONS.map(([value, label]) => {
      const opt = el("option", { value }, label);
      if (me.preferredLanguage === value) opt.setAttribute("selected", "true");
      return opt;
    }),
  ]);
  const notice = fieldNotice();
  const btn = el("button", { type: "button", class: "btn btn-primary btn-sm" }, "저장");
  btn.addEventListener("click", async () => {
    if (!select.value) return;
    try {
      await authJson("/users/me/preferred-language", { method: "PATCH", body: JSON.stringify({ language: select.value }) });
      notice.ok("기본 제출 언어가 저장됐습니다.");
    } catch (err) {
      notice.fail(err);
    }
  });
  card.appendChild(el("div", { class: "inline-form" }, [select, btn]));
  card.append(...notice.nodes);
  return card;
}

function renderDeleteAccountSection() {
  const card = el("div", { class: "settings-card settings-card-danger" }, el("p", { class: "settings-title settings-title-danger" }, "회원 탈퇴"));
  card.appendChild(el("p", { class: "field-hint" }, "계정과 모든 활동 기록(제출, 댓글 등)이 삭제되며 되돌릴 수 없습니다. 비밀번호를 입력해 확인해주세요."));
  const input = el("input", { class: "field-input field-input-sm", type: "password", placeholder: "비밀번호" });
  const notice = fieldNotice();
  const btn = el("button", { type: "button", class: "btn btn-danger btn-sm" }, "탈퇴");
  btn.addEventListener("click", async () => {
    if (!input.value) return;
    if (!window.confirm("정말 탈퇴할까요?\n제출 기록·댓글 등 모든 활동이 함께 삭제되며 되돌릴 수 없습니다.")) return;
    try {
      await authJson("/users/me/delete-account", { method: "POST", body: JSON.stringify({ password: input.value }) });
      localStorage.removeItem("oj_token");
      window.location.href = "/";
    } catch (err) {
      notice.fail(err);
    }
  });
  card.appendChild(el("div", { class: "inline-form" }, [input, btn]));
  card.append(...notice.nodes);
  return card;
}

main();
