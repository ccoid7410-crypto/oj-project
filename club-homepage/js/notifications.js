// 헤더의 종 아이콘과 알림 페이지(notifications.html)를 담당한다.
// 알림은 로그인한 사용자에게만 의미가 있으므로 토큰이 없으면 아무것도 하지 않는다.
(function () {
  const token = localStorage.getItem("oj_token");

  function authFetch(path, options = {}) {
    return fetch(`/api${path}`, {
      ...options,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
  }

  const TYPE_LABEL = {
    REPORT_RECEIVED: "신고 접수",
    REPORT_RESOLVED: "신고 처리",
    MENTION: "멘션",
    ADMIN_MESSAGE: "관리자 알림",
  };

  function fmt(s) {
    return new Date(s).toLocaleString("ko-KR");
  }

  /**
   * 보낸 사람 표시. 실제 계정이면 게시글 작성자와 같은 규격(프로필 사진 + 아이디)의
   * 링크로 그리고, 시스템 발신(Durunuri OJ)은 이름만 보여준다.
   */
  function senderNode(n) {
    if (!n.senderUsername) {
      const span = document.createElement("span");
      span.textContent = n.sender;
      return span;
    }
    const a = document.createElement("a");
    a.className = "notif-sender";
    a.href = `/users/${encodeURIComponent(n.senderUsername)}`;
    const avatar = document.createElement("span");
    avatar.className = "c-avatar";
    avatar.style.width = "16px";
    avatar.style.height = "16px";
    if (n.senderAvatarVersion) {
      const img = document.createElement("img");
      img.src = `/api/users/${encodeURIComponent(n.senderUsername)}/avatar?v=${n.senderAvatarVersion}`;
      img.alt = "";
      avatar.appendChild(img);
    }
    a.append(avatar, document.createTextNode(n.senderUsername));
    return a;
  }

  // ===== 헤더 종 아이콘 =====

  function mountBell() {
    const slot = document.getElementById("notif-slot");
    if (!slot || !token) return;

    const link = document.createElement("a");
    link.href = "notifications.html";
    link.className = "notif-bell";
    link.title = "알림";
    link.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>' +
      '<path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
    const badge = document.createElement("span");
    badge.className = "notif-badge";
    badge.hidden = true;
    link.appendChild(badge);
    slot.appendChild(link);

    authFetch("/notifications/unread-count")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !data.count) return;
        badge.textContent = data.count > 99 ? "99+" : String(data.count);
        badge.hidden = false;
      })
      .catch(() => {});
  }

  // ===== 알림 페이지 =====

  async function renderList(root) {
    root.innerHTML = '<p class="loading">알림을 불러오는 중...</p>';
    let items;
    try {
      const res = await authFetch("/notifications");
      if (!res.ok) throw new Error();
      items = await res.json();
    } catch {
      root.innerHTML = '<p class="error">알림을 불러오지 못했습니다.</p>';
      return;
    }

    root.innerHTML = "";
    const head = document.createElement("div");
    head.className = "notif-head";
    const h2 = document.createElement("h2");
    h2.textContent = "알림";
    head.appendChild(h2);
    if (items.some((n) => !n.read)) {
      const readAll = document.createElement("button");
      readAll.type = "button";
      readAll.className = "btn btn-ghost btn-sm";
      readAll.textContent = "모두 읽음";
      readAll.addEventListener("click", async () => {
        await authFetch("/notifications/read-all", { method: "POST" });
        renderList(root);
      });
      head.appendChild(readAll);
    }
    root.appendChild(head);

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "field-hint";
      empty.textContent = "아직 받은 알림이 없습니다.";
      root.appendChild(empty);
      return;
    }

    const list = document.createElement("ul");
    list.className = "notif-list";
    for (const n of items) {
      const li = document.createElement("li");
      li.className = "notif-item" + (n.read ? "" : " unread");
      const a = document.createElement("a");
      a.href = `notifications.html?id=${encodeURIComponent(n.id)}`;

      const top = document.createElement("div");
      top.className = "notif-item-top";
      const type = document.createElement("span");
      type.className = "notif-type";
      type.textContent = TYPE_LABEL[n.type] || "알림";
      const title = document.createElement("span");
      title.className = "notif-title";
      title.textContent = n.title;
      top.append(type, title);

      const meta = document.createElement("div");
      meta.className = "notif-meta";
      meta.append(senderNode(n), document.createTextNode(` · ${fmt(n.createdAt)}`));

      a.append(top, meta);
      li.appendChild(a);
      list.appendChild(li);
    }
    root.appendChild(list);
  }

  async function renderDetail(root, id) {
    root.innerHTML = '<p class="loading">알림을 불러오는 중...</p>';
    let n;
    try {
      const res = await authFetch(`/notifications/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error();
      n = await res.json();
    } catch {
      root.innerHTML = '<p class="error">알림을 찾을 수 없습니다.</p>';
      return;
    }

    root.innerHTML = "";
    const back = document.createElement("a");
    back.className = "c-back";
    back.href = "notifications.html";
    back.textContent = "← 알림";
    root.appendChild(back);

    const type = document.createElement("span");
    type.className = "notif-type";
    type.textContent = TYPE_LABEL[n.type] || "알림";
    const h2 = document.createElement("h2");
    h2.className = "notif-detail-title";
    h2.textContent = n.title;
    const meta = document.createElement("p");
    meta.className = "notif-meta";
    meta.append(senderNode(n), document.createTextNode(` · ${fmt(n.createdAt)}`));

    const body = document.createElement("p");
    body.className = "notif-body";
    body.textContent = n.body || "";

    root.append(type, h2, meta, body);

    if (n.linkUrl) {
      const go = document.createElement("a");
      go.className = "btn btn-primary btn-sm";
      go.href = n.linkUrl;
      go.textContent = "관련 내용 보러 가기";
      root.appendChild(go);
    }
  }

  function mountPage() {
    const root = document.getElementById("notifications-root");
    if (!root) return;
    if (!token) {
      root.innerHTML = '<p class="field-hint">알림은 로그인 후 확인할 수 있습니다.</p>';
      return;
    }
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) renderDetail(root, id);
    else renderList(root);
  }

  mountBell();
  mountPage();
})();
