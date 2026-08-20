const scopeList = document.getElementById("exam-scope-list");
const scopeSummary = document.getElementById("exam-scope-summary");
const scopeClass = document.getElementById("exam-scope-class");
const scopeTypeButtons = document.querySelectorAll("[data-scope-type]");

let allScopeSchedules = [];
let selectedType = "ALL";

function localDateString() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatScopeDate(schedule) {
  if (schedule.type === "ASSESSMENT") {
    return `${schedule.startsOn}${schedule.deadlineTime ? ` ${schedule.deadlineTime} 마감` : ""}`;
  }
  return schedule.startsOn === schedule.endsOn
    ? schedule.startsOn
    : `${schedule.startsOn} ~ ${schedule.endsOn}`;
}

function appendClassTags(card, classTags) {
  const tags = document.createElement("div");
  tags.className = "calendar-class-tags";
  const values = classTags.length > 0 ? classTags : ["전체 반"];
  for (const value of values) {
    const tag = document.createElement("span");
    tag.className = "calendar-class-tag";
    tag.textContent = value;
    tags.appendChild(tag);
  }
  card.appendChild(tags);
}

function createScopeCard(schedule, today) {
  const card = document.createElement("article");
  card.className = `exam-scope-card schedule-${schedule.type.toLowerCase()}`;

  const top = document.createElement("div");
  top.className = "exam-scope-card-top";
  const badge = document.createElement("span");
  badge.className = "calendar-schedule-badge";
  badge.textContent = schedule.type === "ASSESSMENT" ? "수행평가" : "시험";
  const date = document.createElement("time");
  date.textContent = formatScopeDate(schedule);
  top.append(badge, date);

  const title = document.createElement("h3");
  title.textContent = schedule.subject
    ? `${schedule.subject} · ${schedule.title}`
    : schedule.title;
  card.append(top, title);
  appendClassTags(card, schedule.classTags);

  const scope = document.createElement("div");
  scope.className = "exam-scope-content";
  const label = document.createElement("strong");
  label.textContent = "범위";
  const content = document.createElement("p");
  content.textContent = schedule.examScope || "아직 등록된 범위가 없습니다.";
  if (!schedule.examScope) content.classList.add("exam-scope-empty");
  scope.append(label, content);
  card.appendChild(scope);

  if (schedule.description) {
    const description = document.createElement("p");
    description.className = "exam-scope-description";
    description.textContent = schedule.description;
    card.appendChild(description);
  }

  if (schedule.endsOn < today) card.classList.add("exam-scope-past");
  return card;
}

function renderScopeSchedules() {
  const selectedClass = scopeClass.value;
  const today = localDateString();
  const schedules = allScopeSchedules.filter((schedule) => {
    const matchesType = selectedType === "ALL" || schedule.type === selectedType;
    const matchesClass =
      selectedClass === "ALL" ||
      schedule.classTags.length === 0 ||
      schedule.classTags.includes(selectedClass);
    return matchesType && matchesClass;
  });

  scopeList.innerHTML = "";
  scopeSummary.textContent = `총 ${schedules.length}개의 일정`;
  if (schedules.length === 0) {
    const empty = document.createElement("div");
    empty.className = "calendar-empty";
    const strong = document.createElement("strong");
    strong.textContent = "조건에 맞는 시험 일정이 없습니다.";
    const desc = document.createElement("p");
    desc.textContent = "달력에서 일정을 제안하거나 다른 필터를 선택해보세요.";
    empty.append(strong, desc);
    scopeList.appendChild(empty);
    return;
  }

  const upcoming = schedules.filter((schedule) => schedule.endsOn >= today);
  const past = schedules.filter((schedule) => schedule.endsOn < today).reverse();
  for (const [labelText, items] of [["예정된 일정", upcoming], ["지난 일정", past]]) {
    if (items.length === 0) continue;
    const section = document.createElement("section");
    section.className = "exam-scope-group";
    const heading = document.createElement("h3");
    heading.textContent = `${labelText} ${items.length}`;
    const grid = document.createElement("div");
    grid.className = "exam-scope-grid";
    for (const schedule of items) grid.appendChild(createScopeCard(schedule, today));
    section.append(heading, grid);
    scopeList.appendChild(section);
  }
}

async function loadScopeSchedules() {
  try {
    const token = localStorage.getItem("oj_token");
    const response = await fetch("/api/club-schedules", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error();
    const schedules = await response.json();
    allScopeSchedules = schedules.filter(
      (schedule) => schedule.type === "ASSESSMENT" || schedule.type === "EXAM",
    );
    renderScopeSchedules();
  } catch {
    scopeList.innerHTML = '<p class="error">시험범위를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>';
  }
}

if (scopeList && scopeSummary && scopeClass) {
  scopeClass.addEventListener("change", renderScopeSchedules);
  scopeTypeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedType = button.dataset.scopeType;
      scopeTypeButtons.forEach((item) => item.classList.toggle("active", item === button));
      renderScopeSchedules();
    });
  });
  window.clubProfileReady?.then((profile) => {
    if (profile) void loadScopeSchedules();
  });
}
