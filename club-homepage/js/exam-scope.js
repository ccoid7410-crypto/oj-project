const scopeList = document.getElementById("exam-scope-list");
const scopeSummary = document.getElementById("exam-scope-summary");
const examTypeButtons = document.querySelectorAll("[data-exam-type]");
const addButton = document.getElementById("exam-scope-add");

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

/** 과목 이름·범위·순서를 바꾸는 요청. 넘긴 항목만 반영된다. */
async function patchScope(item, patch) {
  const response = await fetch(`/api/exam-scopes/${encodeURIComponent(item.id)}`, {
    method: "PATCH",
    headers: authHeaders(true),
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || "저장하지 못했습니다.");
  }
  return response.json();
}

async function onRenameSubject(item) {
  const next = window.prompt("과목 이름", item.subject);
  if (next === null) return;
  const subject = next.trim();
  if (!subject || subject === item.subject) return;
  try {
    const updated = await patchScope(item, { subject });
    item.subject = updated.subject;
    renderExamScopes();
  } catch (err) {
    alert(err instanceof Error ? err.message : "저장하지 못했습니다.");
  }
}

/** 목록에서 위/아래로 한 칸 옮긴다(옆 과목과 displayOrder를 맞바꾼다). */
async function onMoveSubject(item, delta) {
  const index = examScopes.indexOf(item);
  const other = examScopes[index + delta];
  if (!other) return;
  try {
    // 순서 값이 같으면(초기 데이터) 인덱스 기준으로 다시 매겨야 자리가 바뀐다.
    const a = item.displayOrder === other.displayOrder ? index : item.displayOrder;
    const b = item.displayOrder === other.displayOrder ? index + delta : other.displayOrder;
    await patchScope(item, { displayOrder: b });
    await patchScope(other, { displayOrder: a });
    item.displayOrder = b;
    other.displayOrder = a;
    examScopes.splice(index, 1);
    examScopes.splice(index + delta, 0, item);
    renderExamScopes();
  } catch (err) {
    alert(err instanceof Error ? err.message : "순서를 바꾸지 못했습니다.");
  }
}

async function onAddSubject() {
  const name = window.prompt("추가할 과목 이름");
  if (name === null) return;
  const subject = name.trim();
  if (!subject) return;
  try {
    const response = await fetch("/api/exam-scopes", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        academicYear: ACADEMIC_YEAR,
        semester: SEMESTER,
        examType: selectedExamType,
        subject,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.message || "과목을 추가하지 못했습니다.");
    }
    await loadExamScopes();
  } catch (err) {
    alert(err instanceof Error ? err.message : "과목을 추가하지 못했습니다.");
  }
}

function createScopeCard(item, index) {
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
    const tools = document.createElement("div");
    tools.className = "exam-scope-tools";
    const up = createActionButton("↑", "exam-scope-move", () => onMoveSubject(item, -1));
    up.title = "위로";
    up.disabled = index === 0;
    const down = createActionButton("↓", "exam-scope-move", () => onMoveSubject(item, 1));
    down.title = "아래로";
    down.disabled = index === examScopes.length - 1;
    tools.append(
      up,
      down,
      createActionButton("이름", "exam-scope-edit-button", () => onRenameSubject(item)),
      createActionButton("범위 수정", "exam-scope-edit-button", () => renderEditor(item, content)),
    );
    top.appendChild(tools);
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
  examScopes.forEach((item, index) => grid.appendChild(createScopeCard(item, index)));
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
  addButton?.addEventListener("click", () => void onAddSubject());

  // 시험범위는 로그인 없이도 볼 수 있다. 프로필은 편집 권한 판별에만 쓰고,
  // 목록은 프로필 조회 결과와 상관없이 처음부터 불러온다.
  void loadExamScopes();
  window.clubProfileReady?.then((profile) => {
    if (!profile) return;
    // 시험범위 편집(과목 추가·이름·범위·순서)은 지정 관리자(hift)만 할 수 있다.
    canEdit = profile.username === "hift";
    if (!canEdit) return;
    if (addButton) addButton.hidden = false;
    renderExamScopes(); // 편집 버튼을 뒤늦게 붙인다
  });
}
