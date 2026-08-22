const scopeList = document.getElementById("exam-scope-list");
const scopeSummary = document.getElementById("exam-scope-summary");
const examTypeButtons = document.querySelectorAll("[data-exam-type]");

const ACADEMIC_YEAR = 2026;
const SEMESTER = 2;
const EXAM_LABELS = { MIDTERM: "중간고사", FINAL: "기말고사" };

let selectedExamType = "MIDTERM";
let examScopes = [];
let canEdit = false;

function authHeaders(includeJson = false) {
  const token = localStorage.getItem("oj_token");
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function createActionButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function renderEditor(item, content) {
  const editor = document.createElement("textarea");
  editor.className = "exam-scope-editor";
  editor.maxLength = 5000;
  editor.placeholder = "시험 범위를 입력하세요.";
  editor.value = item.scope;

  const actions = document.createElement("div");
  actions.className = "exam-scope-edit-actions";
  const save = createActionButton("저장", "primary", async () => {
    save.disabled = true;
    try {
      const response = await fetch(`/api/exam-scopes/${encodeURIComponent(item.id)}`, {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({ scope: editor.value }),
      });
      if (!response.ok) throw new Error();
      const updated = await response.json();
      item.scope = updated.scope;
      renderExamScopes();
    } catch {
      alert("시험범위를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
      save.disabled = false;
    }
  });
  const cancel = createActionButton("취소", "", renderExamScopes);
  actions.append(save, cancel);
  content.replaceChildren(editor, actions);
  editor.focus();
}

function createScopeCard(item) {
  const card = document.createElement("article");
  card.className = "exam-scope-card";

  const top = document.createElement("div");
  top.className = "exam-scope-card-top";
  const badge = document.createElement("span");
  badge.className = "exam-period-badge";
  badge.textContent = EXAM_LABELS[item.examType];
  top.appendChild(badge);

  const content = document.createElement("div");
  content.className = "exam-scope-content";
  if (canEdit) {
    top.appendChild(
      createActionButton("범위 수정", "exam-scope-edit-button", () => {
        renderEditor(item, content);
      }),
    );
  }

  const title = document.createElement("h3");
  title.textContent = item.subject;
  const scope = document.createElement("p");
  scope.textContent = item.scope || "아직 안 나왔습니다~";
  if (!item.scope) scope.className = "exam-scope-empty";
  content.appendChild(scope);

  card.append(top, title, content);
  return card;
}

function renderExamScopes() {
  scopeList.replaceChildren();
  scopeSummary.textContent = `${ACADEMIC_YEAR}학년도 ${SEMESTER}학기 · ${EXAM_LABELS[selectedExamType]} · ${examScopes.length}과목`;
  const grid = document.createElement("div");
  grid.className = "exam-scope-grid";
  for (const item of examScopes) grid.appendChild(createScopeCard(item));
  scopeList.appendChild(grid);
}

async function loadExamScopes() {
  scopeList.innerHTML = '<p class="loading">시험범위를 불러오는 중...</p>';
  try {
    const query = new URLSearchParams({
      academicYear: String(ACADEMIC_YEAR),
      semester: String(SEMESTER),
      examType: selectedExamType,
    });
    const response = await fetch(`/api/exam-scopes?${query}`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error();
    examScopes = await response.json();
    renderExamScopes();
  } catch {
    scopeSummary.textContent = "";
    scopeList.innerHTML = '<p class="error">시험범위를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>';
  }
}

if (scopeList && scopeSummary) {
  examTypeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedExamType = button.dataset.examType;
      examTypeButtons.forEach((item) => item.classList.toggle("active", item === button));
      void loadExamScopes();
    });
  });
  // 시험범위는 로그인 없이도 볼 수 있다. 프로필은 수정 권한 판별에만 쓰고,
  // 목록은 프로필 조회 결과와 상관없이 처음부터 불러온다.
  void loadExamScopes();
  window.clubProfileReady?.then((profile) => {
    if (!profile) return;
    canEdit = profile.username === "hift";
    if (canEdit) renderExamScopes(); // 수정 버튼을 뒤늦게 붙인다
  });
}
