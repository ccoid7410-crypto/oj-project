document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth" });
  });
});

const API_BASE = "/api";

const authArea = document.getElementById("auth-area");

/* ===== 헤더 테마 버튼 (OJ 헤더와 동일한 규격·동작) =====
   라이트 → 다크 → 시스템 순으로 돌고, 저장소(oj_theme)를 OJ와 공유하므로
   한쪽에서 바꾸면 다른 쪽에도 그대로 반영된다. */
const THEME_ORDER = ["light", "dark", "system"];
const THEME_LABEL = {
  light: "라이트 모드",
  dark: "다크 모드",
  system: "시스템 설정 따름",
};
const THEME_ICON = {
  light:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  dark: '<path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>',
  system: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
};

function mountThemeToggle() {
  const actions = document.querySelector(".header-actions");
  if (!actions || !window.ojTheme) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "header-icon-btn";

  function paint() {
    const pref = window.ojTheme.stored();
    button.title = THEME_LABEL[pref];
    button.setAttribute("aria-label", `테마: ${THEME_LABEL[pref]} (눌러서 변경)`);
    button.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      THEME_ICON[pref] +
      "</svg>";
  }

  button.addEventListener("click", () => {
    const pref = window.ojTheme.stored();
    const next = THEME_ORDER[(THEME_ORDER.indexOf(pref) + 1) % THEME_ORDER.length];
    window.ojTheme.set(next);
    paint();
    // 로그인 상태면 계정에도 저장해 OJ에서도 같은 테마로 열린다.
    const token = localStorage.getItem("oj_token");
    if (!token) return;
    fetch(`${API_BASE}/users/me/theme`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {});
  });

  paint();
  // OJ 헤더와 같은 순서: [테마] [계정] [알림]
  actions.prepend(button);
}

mountThemeToggle();

/* ===== 헤더 설정(톱니) 아이콘 =====
   OJ 헤더와 같은 위치(종 아이콘 오른쪽)에 두고, 누르면 OJ의 설정 페이지(/settings)로 간다.
   설정 페이지는 OJ 앱에 있고 홈페이지와 같은 origin이라 절대 경로로 바로 연결된다.
   로그인 여부와 무관하게 항상 보이고, 비로그인으로 들어가면 설정 페이지가 안내 화면을 띄운다. */
function mountSettingsGear() {
  const actions = document.querySelector(".header-actions");
  if (!actions) return;

  const link = document.createElement("a");
  link.href = "/settings";
  link.className = "notif-bell"; // 종 아이콘과 같은 규격(20px 박스 / 16px 아이콘)
  link.title = "설정";
  link.setAttribute("aria-label", "설정");
  link.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="3"/>' +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  // 종(#notif-slot)보다 뒤에 붙여 맨 오른쪽에 오게 한다.
  actions.appendChild(link);
}

mountSettingsGear();

function setHeroActionsVisible(visible) {
  const actions = document.querySelector(".hero-actions");
  if (actions) actions.style.display = visible ? "" : "none";
}

function renderLoggedOut() {
  setHeroActionsVisible(true);
  authArea.innerHTML = "";
  const login = document.createElement("a");
  login.href =
    "/login?redirect=" +
    encodeURIComponent(window.location.pathname + window.location.search);
  login.textContent = "로그인";
  const signup = document.createElement("a");
  signup.href = "/signup";
  signup.textContent = "회원가입";
  authArea.append(login, signup);
}

function renderLoggedIn(user) {
  setHeroActionsVisible(false);
  authArea.innerHTML = "";
  // 헤더의 계정 버튼(사진+아이디)은 OJ 프로필로 연결한다 (마이페이지는 제거됨)
  const profile = document.createElement("a");
  profile.href = `/users/${encodeURIComponent(user.username)}`;
  profile.className = "auth-profile-link";

  // OJ 헤더와 동일하게 닉네임 왼쪽에 프로필 사진(없으면 회색 원)을 보여준다.
  const avatar = document.createElement("span");
  avatar.className = "auth-avatar";
  if (user.avatarVersion) {
    const img = document.createElement("img");
    img.src = `${API_BASE}/users/${encodeURIComponent(user.username)}/avatar?v=${user.avatarVersion}`;
    img.alt = "";
    avatar.appendChild(img);
  }
  profile.appendChild(avatar);
  profile.appendChild(document.createTextNode(user.username));
  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.textContent = "로그아웃";
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("oj_token");
    // 화면을 새로 그려야 게이트가 다시 걸린다. 그냥 헤더만 바꾸면 로그인 전용
    // 페이지(동아리 게시판 등)의 내용이 로그아웃 후에도 그대로 남아 보인다.
    window.location.reload();
  });
  authArea.append(profile, logoutBtn);
}

async function initAuth() {
  if (!authArea) return;
  const token = localStorage.getItem("oj_token");
  if (!token) {
    renderLoggedOut();
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`API 응답 오류: ${res.status}`);
    renderLoggedIn(await res.json());
  } catch {
    renderLoggedOut();
  }
}

initAuth();

window.clubProfileReady?.then((profile) => {
  if (!profile || profile.role !== "ADMIN") return;
  const nav = document.querySelector(".header-nav");
  if (!nav) return;
  const adminLink = document.createElement("a");
  adminLink.href = "/admin";
  adminLink.textContent = "관리자";
  nav.insertBefore(adminLink, nav.querySelector(".nav-oj"));
});
