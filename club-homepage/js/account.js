const accountInfo = document.getElementById("account-info");

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

  accountInfo.append(table, actions);
});
