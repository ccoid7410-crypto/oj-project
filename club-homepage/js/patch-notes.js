// OJ 홈페이지 우하단에 뜨는 "최근 업데이트" 플로팅 위젯(js/patch-notes.js, oj-frontend/src/components/PatchNotes.tsx)을
// 동아리 홈페이지(index.html)에도 똑같은 레이아웃/동작으로 띄운다. 같은 공개 API(/api/patch-notes)를 쓴다.
const PN_STORAGE_KEY = "patchNotesMinimized";

function pnFmtDate(s) {
  return new Date(s).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
function pnIsToday(s) {
  return new Date(s).toDateString() === new Date().toDateString();
}

const PN_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>';
const PN_CLOSE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

let pnCommits = [];
let pnLoading = true;
let pnError = null;
let pnMinimized = localStorage.getItem(PN_STORAGE_KEY) === "true";

function pnSetMinimized(value) {
  pnMinimized = value;
  localStorage.setItem(PN_STORAGE_KEY, String(value));
  pnRender();
}

function pnGetRoot() {
  let root = document.getElementById("patch-notes-widget");
  if (!root) {
    root = document.createElement("div");
    root.id = "patch-notes-widget";
    document.body.appendChild(root);
  }
  return root;
}

function pnRender() {
  const root = pnGetRoot();
  root.innerHTML = "";

  if (pnLoading) {
    const card = document.createElement("div");
    card.className = "pn-card";
    card.innerHTML =
      '<div class="pn-card-header"><span class="pn-card-title">🚀 최근 업데이트</span></div>' +
      '<div class="pn-skeleton"><div class="pn-skeleton-bar"></div><div class="pn-skeleton-bar"></div><div class="pn-skeleton-bar"></div></div>';
    root.appendChild(card);
    return;
  }

  if (pnMinimized) {
    const hasToday = pnCommits.some((c) => pnIsToday(c.commit.author.date));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pn-fab";
    btn.title = "최근 업데이트 보기";
    btn.innerHTML = PN_ICON + (hasToday ? '<span class="pn-fab-badge"></span>' : "");
    btn.addEventListener("click", () => pnSetMinimized(false));
    root.appendChild(btn);
    return;
  }

  const card = document.createElement("div");
  card.className = "pn-card";

  const glow = document.createElement("div");
  glow.className = "pn-card-glow";

  const header = document.createElement("div");
  header.className = "pn-card-header";
  const title = document.createElement("span");
  title.className = "pn-card-title";
  title.innerHTML = '<span class="accent">✦</span> 최근 업데이트';
  const actions = document.createElement("div");
  actions.className = "pn-card-actions";
  const moreLink = document.createElement("a");
  moreLink.href = "/patch-notes";
  moreLink.className = "pn-more-link";
  moreLink.textContent = "전체 보기 >";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "pn-close-btn";
  closeBtn.title = "숨기기";
  closeBtn.innerHTML = PN_CLOSE_ICON;
  closeBtn.addEventListener("click", () => pnSetMinimized(true));
  actions.append(moreLink, closeBtn);
  header.append(title, actions);

  const timeline = document.createElement("div");
  timeline.className = "pn-timeline";

  if (pnError) {
    timeline.innerHTML = `<p class="error">${pnError}</p>`;
  } else if (pnCommits.length === 0) {
    timeline.innerHTML = '<p class="empty">업데이트 내역이 없습니다.</p>';
  } else {
    for (const c of pnCommits) {
      const item = document.createElement("div");
      item.className = "pn-item";
      const isToday = pnIsToday(c.commit.author.date);

      const dateRow = document.createElement("div");
      dateRow.className = "pn-item-date";
      dateRow.textContent = pnFmtDate(c.commit.author.date);
      if (isToday) {
        const badge = document.createElement("span");
        badge.className = "pn-item-new";
        badge.textContent = "NEW";
        dateRow.appendChild(badge);
      }

      const titleRow = document.createElement("div");
      titleRow.className = "pn-item-title";
      titleRow.textContent = c.commit.message.split("\n")[0];

      item.append(dateRow, titleRow);
      timeline.appendChild(item);
    }
  }

  card.append(glow, header, timeline);
  root.appendChild(card);
}

async function pnLoad() {
  pnRender();
  try {
    const res = await fetch("/api/patch-notes");
    if (!res.ok) throw new Error(`API 응답 오류: ${res.status}`);
    const data = await res.json();
    pnCommits = data.slice(0, 3);
  } catch {
    pnError = "업데이트 내역을 불러오지 못했습니다.";
  } finally {
    pnLoading = false;
    pnRender();
  }
}

pnLoad();
