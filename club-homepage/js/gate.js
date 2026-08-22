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

window.clubProfileReady = (async () => {
  const loginUrl =
    "/login?redirect=" +
    encodeURIComponent(window.location.pathname + window.location.search);
  // 공개 페이지(메인·일정·커뮤니티)는 js/public-gate-config.js에서
  // GATE_REQUIRE_LOGIN/MEMBER = false 를 미리 선언해서 로그인 없이도 볼 수 있게 한다.
  // (CSP script-src 'self' 때문에 HTML 인라인 <script>로는 값을 못 넣는다.)
  // 나머지 페이지는 기존대로 로그인한 동아리 부원만 이용 가능.
  const requireLogin = window.GATE_REQUIRE_LOGIN !== false;
  const requireMember = window.GATE_REQUIRE_MEMBER !== false;
  try {
    const token = localStorage.getItem("oj_token");
    if (!token) {
      if (!requireLogin) return null;
      renderGateScreen(
        "동아리 회원 전용 공간입니다",
        "두루누리 홈페이지의 일부는 로그인한 동아리 회원만 이용할 수 있습니다.",
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
        "동아리 부원만 접속할 수 있습니다",
        "관리자에게 부원 등록을 요청해주세요. 부원으로 등록되면 홈페이지를 이용할 수 있습니다.",
        [{ href: "/", label: "OJ로 가기", primary: true }],
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
