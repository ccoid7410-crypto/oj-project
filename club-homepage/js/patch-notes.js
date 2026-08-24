// OJ 홈페이지의 "최근 업데이트"(GitHub 커밋 로그, /api/patch-notes)를 동아리
// 홈페이지 메인에도 똑같이 보여준다. 인증이 필요 없는 공개 API라 게이트와 무관하게 바로 불러온다.
const updateLogList = document.getElementById("update-log-list");

function fmtUpdateDate(s) {
  return new Date(s).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function renderUpdateLog(commits) {
  updateLogList.innerHTML = "";
  if (!commits.length) {
    updateLogList.innerHTML = '<p class="empty">업데이트 내역이 없습니다.</p>';
    return;
  }
  const list = document.createElement("ul");
  list.className = "update-log-list";
  for (const c of commits) {
    const item = document.createElement("li");
    item.className = "update-log-item";

    const date = document.createElement("span");
    date.className = "update-log-date";
    date.textContent = fmtUpdateDate(c.commit.author.date);

    const title = document.createElement("span");
    title.className = "update-log-title";
    title.textContent = c.commit.message.split("\n")[0];

    item.append(date, title);
    list.appendChild(item);
  }
  updateLogList.appendChild(list);
}

async function loadUpdateLog() {
  if (!updateLogList) return;
  try {
    const res = await fetch("/api/patch-notes");
    if (!res.ok) throw new Error(`API 응답 오류: ${res.status}`);
    const commits = await res.json();
    renderUpdateLog(commits.slice(0, 5));
  } catch {
    updateLogList.innerHTML = '<p class="error">업데이트 내역을 불러오지 못했습니다. 잠시 후 새로고침 해주세요.</p>';
  }
}

loadUpdateLog();
