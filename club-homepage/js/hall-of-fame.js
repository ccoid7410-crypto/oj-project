const hofList = document.getElementById("hof-list");

function renderHallOfFame(groups) {
  hofList.innerHTML = "";
  if (!groups.length) {
    hofList.innerHTML = '<p class="empty">아직 등록된 회원이 없습니다.</p>';
    return;
  }
  for (const group of groups) {
    const section = document.createElement("div");
    section.className = "hof-generation";

    const title = document.createElement("h3");
    title.textContent = group.generation === "기타" ? "기타" : `${group.generation}기`;

    const count = document.createElement("span");
    count.className = "hof-count";
    count.textContent = `${group.members.length}명`;
    title.appendChild(count);

    const list = document.createElement("ul");
    list.className = "hof-members";
    for (const username of group.members) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `/users/${encodeURIComponent(username)}`;
      link.textContent = username;
      item.appendChild(link);
      list.appendChild(item);
    }

    section.append(title, list);
    hofList.appendChild(section);
  }
}

async function loadHallOfFame() {
  if (!hofList) return;
  try {
    const res = await fetch("/api/users/hall-of-fame", {
      headers: { Authorization: `Bearer ${localStorage.getItem("oj_token")}` },
    });
    if (!res.ok) throw new Error(`API 응답 오류: ${res.status}`);
    renderHallOfFame(await res.json());
  } catch {
    hofList.innerHTML =
      '<p class="error">목록을 불러오지 못했습니다. 잠시 후 새로고침 해주세요.</p>';
  }
}

window.clubProfileReady.then((profile) => {
  if (profile) loadHallOfFame();
});
