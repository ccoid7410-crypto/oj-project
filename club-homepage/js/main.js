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
  // 마이페이지가 OJ 프로필 페이지로 통합됐으므로 곧바로 그리로 연결한다.
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
    renderLoggedOut();
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
