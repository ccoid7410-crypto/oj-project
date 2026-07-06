// main.js — 동아리 홈페이지의 동적 기능을 담당하는 파일입니다.

// 메뉴(#소개, #활동 등)를 클릭하면 해당 위치로 부드럽게 스크롤합니다.
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return; // href="#" 처럼 대상이 없으면 기본 동작 유지
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth" });
  });
});

// ===== OJ 계정 연동 =====
// 이 홈페이지와 OJ는 같은 주소(origin)에서 서비스되기 때문에 localStorage를 공유합니다.
// OJ가 로그인할 때 저장하는 토큰(oj_token)을 그대로 읽어서 로그인 상태를 표시하고,
// 여기서 로그아웃하면 토큰이 지워져 OJ 쪽도 함께 로그아웃됩니다.
const API_BASE = "/api"; // frontend nginx가 OJ 백엔드로 프록시해주는 경로 (nginx.conf 참고)

const authArea = document.getElementById("auth-area");

// 로그인 안 된 상태: OJ의 로그인/회원가입 페이지로 가는 링크를 보여준다
function renderLoggedOut() {
  authArea.innerHTML = "";
  const login = document.createElement("a");
  // 로그인 후 다시 이 페이지로 돌아올 수 있게 현재 위치를 redirect 파라미터로 넘긴다
  login.href =
    "/login?redirect=" +
    encodeURIComponent(window.location.pathname + window.location.search);
  login.textContent = "로그인";
  const signup = document.createElement("a");
  signup.href = "/signup";
  signup.textContent = "회원가입";
  authArea.append(login, signup);
}

// 로그인 된 상태: 아이디(프로필 링크)와 로그아웃 버튼을 보여준다
function renderLoggedIn(user) {
  authArea.innerHTML = "";
  const profile = document.createElement("a");
  profile.href = `/users/${encodeURIComponent(user.username)}`;
  profile.className = "username";
  profile.textContent = user.username;
  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.textContent = "로그아웃";
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("oj_token"); // OJ와 공유하는 토큰이므로 OJ도 함께 로그아웃된다
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
    // 토큰이 만료됐거나 서버에 연결할 수 없는 경우.
    // 토큰 삭제 여부는 OJ 쪽 로직에 맡기고 여기서는 표시만 로그아웃 상태로 한다.
    renderLoggedOut();
  }
}

initAuth();

// 나중에 여기에 추가할 수 있는 것들:
// - OJ API와 연동해서 동아리원 랭킹 보여주기 (oj-backend의 external API 활용)
// - 공지사항 영역
// - 활동 사진 갤러리
