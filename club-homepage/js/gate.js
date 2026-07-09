const gateMain = document.querySelector("main");

function renderGateScreen(title, message, buttons) {
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
  try {
    const token = localStorage.getItem("oj_token");
    if (!token) {
      renderGateScreen(
        "동아리 회원 전용 공간입니다",
        "두루누리 홈페이지는 로그인한 동아리 회원만 이용할 수 있습니다.",
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
      renderGateScreen(
        "다시 로그인해주세요",
        "로그인 정보가 만료되었습니다.",
        [{ href: loginUrl, label: "로그인", primary: true }],
      );
      return null;
    }
    if (!res.ok) throw new Error(`API 응답 오류: ${res.status}`);

    const profile = await res.json();
    if (profile.role !== "MEMBER" && profile.role !== "ADMIN") {
      renderGateScreen(
        "동아리 부원만 접속할 수 있습니다",
        "관리자에게 부원 등록을 요청해주세요. 부원으로 등록되면 홈페이지를 이용할 수 있습니다.",
        [{ href: "/", label: "OJ로 가기", primary: true }],
      );
      return null;
    }
    return profile;
  } catch {
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
