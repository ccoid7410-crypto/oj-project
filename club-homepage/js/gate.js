const gateMain = document.querySelector("main");

function renderGateScreen(title, message, buttons) {
  if (!gateMain) return;
  gateMain.innerHTML = "";
  const section = document.createElement("section");
  section.className = "section";

  const heading = document.createElement("h2");
  heading.textContent = title;

  const desc = document.createElement("p");
  desc.textContent = message;

  const actions = document.createElement("div");
  actions.className = "hero-actions";
  for (const b of buttons) {
    const link = document.createElement("a");
    link.href = b.href;
    link.textContent = b.label;
    link.className = b.primary ? "btn btn-primary" : "btn btn-ghost";
    actions.appendChild(link);
  }

  section.append(heading, desc, actions);
  gateMain.appendChild(section);
}

// 페이지를 통째로 막을 때 쓰는 문구. OJ(components/AccessGate.tsx)와 동일하게 맞춘다.
// 제목뿐 아니라 아래 설명도 상황(등급 + 로그인 여부)마다 다르게 안내한다.
const GATE_TEXT = {
  login: {
    title: "일반 회원 전용 공간입니다",
    message: "로그인한 회원만 이용할 수 있는 페이지입니다. 로그인 후 다시 시도해주세요.",
  },
  // 부원 전용인데 아직 로그인조차 안 한 경우
  memberAnon: {
    title: "동아리 회원 전용 공간입니다",
    message: "동아리 부원만 볼 수 있는 페이지입니다. 부원 계정으로 로그인해주세요.",
  },
  // 부원 전용인데 로그인은 했지만 부원이 아닌 경우
  member: {
    title: "동아리 회원 전용 공간입니다",
    message: "동아리 부원만 볼 수 있는 페이지입니다. 관리자에게 부원 등록을 요청해주세요.",
  },
};

window.clubProfileReady = (async () => {
  const loginUrl =
    "/login?redirect=" +
    encodeURIComponent(window.location.pathname + window.location.search);
  // 페이지별 접근 등급은 gate.js보다 먼저 불러오는 설정 파일이 정한다.
  // (CSP script-src 'self' 때문에 HTML 인라인 <script>로는 값을 못 넣는다.)
  //   js/public-gate-config.js  - 누구나 (메인·일정·시험범위)
  //   js/login-gate-config.js   - 로그인만 하면 됨 (공개 게시판·명예의 전당·알림)
  //   (설정 없음)               - 동아리 부원만 (동아리 게시판)
  const requireLogin = window.GATE_REQUIRE_LOGIN !== false;
  const requireMember = window.GATE_REQUIRE_MEMBER !== false;
  try {
    const token = localStorage.getItem("oj_token");
    if (!token) {
      if (!requireLogin) return null;
      const anonText = requireMember ? GATE_TEXT.memberAnon : GATE_TEXT.login;
      renderGateScreen(
        anonText.title,
        anonText.message,
        [
          { href: loginUrl, label: "로그인", primary: true },
          { href: "/signup", label: "회원가입" },
        ],
      );
      return null;
    }

    const res = await fetch("/api/users/me/club-profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      // 공개 페이지(GATE_REQUIRE_LOGIN=false)는 토큰이 남아있지만 만료된 상태여도
      // 게이트로 막지 않고 비로그인처럼 그대로 열람하게 한다.
      if (!requireLogin) return null;
      renderGateScreen(
        "다시 로그인해주세요",
        "로그인 정보가 만료되었습니다.",
        [{ href: loginUrl, label: "로그인", primary: true }],
      );
      return null;
    }
    if (!res.ok) throw new Error(`API 응답 오류: ${res.status}`);

    const profile = await res.json();
    if (requireMember && profile.role !== "MEMBER" && profile.role !== "ADMIN") {
      renderGateScreen(
        GATE_TEXT.member.title,
        GATE_TEXT.member.message,
        [{ href: "index.html", label: "홈으로", primary: true }],
      );
      return null;
    }
    return profile;
  } catch {
    if (!requireLogin) return null;
    renderGateScreen(
      "잠시 후 다시 시도해주세요",
      "서버와 통신하지 못했습니다.",
      [{ href: window.location.pathname, label: "새로고침", primary: true }],
    );
    return null;
  } finally {
    document.body.classList.remove("gate-pending");
  }
})();
