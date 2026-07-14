const accountInfo = document.getElementById("account-info");

function renderThemeSetting() {
  const wrap = document.createElement("div");
  wrap.className = "theme-setting";

  const label = document.createElement("p");
  label.className = "theme-setting-label";
  label.textContent = "색상 설정";

  const group = document.createElement("div");
  group.className = "theme-options";

  function refresh() {
    for (const btn of group.children) {
      btn.classList.toggle("active", btn.dataset.value === window.ojTheme.stored());
    }
  }

  for (const [value, text] of [
    ["system", "시스템"],
    ["light", "라이트"],
    ["dark", "다크"],
  ]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.value = value;
    btn.textContent = text;
    btn.addEventListener("click", () => {
      window.ojTheme.set(value);
      refresh();
      const token = localStorage.getItem("oj_token");
      if (token) {
        fetch("/api/users/me/theme", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ theme: value }),
        }).catch(() => {});
      }
    });
    group.appendChild(btn);
  }
  refresh();

  wrap.append(label, group);
  return wrap;
}

window.clubProfileReady.then((profile) => {
  if (!profile || !accountInfo) return;

  accountInfo.innerHTML = "";

  const table = document.createElement("table");
  table.className = "info-table";
  const rows = [
    ["아이디", profile.username],
    ["이름", profile.name ?? "-"],
    ["기수", profile.generation ? `${profile.generation}기` : "-"],
    ["학번", profile.studentId ?? "미등록"],
    ["레이팅", String(profile.rating)],
    ["권한", profile.role === "ADMIN" ? "관리자" : profile.role === "MEMBER" ? "부원" : "일반 회원"],
    ["가입일", new Date(profile.createdAt).toLocaleDateString("ko-KR")],
  ];
  for (const [label, value] of rows) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = label;
    const td = document.createElement("td");
    td.textContent = value;
    tr.append(th, td);
    table.appendChild(tr);
  }

  const actions = document.createElement("div");
  actions.className = "hero-actions";
  const ojProfile = document.createElement("a");
  ojProfile.href = `/users/${encodeURIComponent(profile.username)}`;
  ojProfile.textContent = "OJ 프로필 보기";
  ojProfile.className = "btn btn-primary";
  const editStudentId = document.createElement("a");
  editStudentId.href = `/users/${encodeURIComponent(profile.username)}`;
  editStudentId.textContent = "학번 등록/수정 (OJ 프로필)";
  editStudentId.className = "btn btn-ghost";
  actions.append(ojProfile, editStudentId);

  accountInfo.append(table, renderThemeSetting(), actions);
});
