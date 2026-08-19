const calendarMonth = document.getElementById("calendar-month");
const calendarGrid = document.getElementById("calendar-grid");
const calendarPrev = document.getElementById("calendar-prev");
const calendarToday = document.getElementById("calendar-today");
const calendarNext = document.getElementById("calendar-next");
const calendarScheduleList = document.getElementById("calendar-schedule-list");
const proposalForm = document.getElementById("schedule-proposal-form");
const proposalMessage = document.getElementById("schedule-proposal-message");
const proposalSubmit = document.getElementById("schedule-submit");
const approvalSection = document.getElementById("schedule-approval-section");
const approvalList = document.getElementById("schedule-approval-list");
const approvalRefresh = document.getElementById("schedule-approval-refresh");

const today = new Date();
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let requestNumber = 0;

function isSameDate(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateRange(schedule) {
  if (schedule.startsOn === schedule.endsOn) return schedule.startsOn;
  return `${schedule.startsOn} ~ ${schedule.endsOn}`;
}

function getAuthHeaders(includeJson = false) {
  const token = localStorage.getItem("oj_token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
  };
}

function appendClassTags(container, classTags) {
  if (!Array.isArray(classTags) || classTags.length === 0) return;
  const tags = document.createElement("div");
  tags.className = "calendar-class-tags";
  for (const classTag of classTags) {
    const tag = document.createElement("span");
    tag.className = "calendar-class-tag";
    tag.textContent = classTag;
    tags.appendChild(tag);
  }
  container.appendChild(tags);
}

function renderCalendar() {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstDay.getDay());

  calendarMonth.textContent = `${year}년 ${month + 1}월`;
  calendarGrid.innerHTML = "";

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    const day = document.createElement("div");
    day.className = "calendar-day";
    day.dataset.date = toDateString(date);
    if (date.getMonth() !== month) day.classList.add("calendar-day-outside");
    if (date.getDay() === 0) day.classList.add("calendar-day-sunday");
    if (date.getDay() === 6) day.classList.add("calendar-day-saturday");

    const number = document.createElement("span");
    number.className = "calendar-day-number";
    number.textContent = String(date.getDate());
    if (isSameDate(date, today)) {
      number.classList.add("calendar-day-today");
      day.setAttribute("aria-current", "date");
    }

    day.appendChild(number);
    calendarGrid.appendChild(day);
  }
}

function renderScheduleList(schedules) {
  calendarScheduleList.innerHTML = "";
  if (schedules.length === 0) {
    const empty = document.createElement("div");
    empty.className = "calendar-empty";
    const strong = document.createElement("strong");
    strong.textContent = "이 달에 등록된 일정이 없습니다.";
    const desc = document.createElement("p");
    desc.textContent = "관리자가 일정을 등록하면 달력에 표시됩니다.";
    empty.append(strong, desc);
    calendarScheduleList.appendChild(empty);
    return;
  }

  const heading = document.createElement("h3");
  heading.className = "calendar-list-heading";
  heading.textContent = "이 달의 일정";
  calendarScheduleList.appendChild(heading);

  const list = document.createElement("div");
  list.className = "calendar-list";
  for (const schedule of schedules) {
    const card = document.createElement("article");
    card.id = `schedule-${schedule.id}`;
    card.className = `calendar-schedule-card schedule-${schedule.type.toLowerCase()}`;

    const top = document.createElement("div");
    top.className = "calendar-schedule-top";
    const badge = document.createElement("span");
    badge.className = "calendar-schedule-badge";
    badge.textContent = schedule.type === "ASSESSMENT" ? "수행평가" : "시험";
    const date = document.createElement("time");
    date.textContent = formatDateRange(schedule);
    top.append(badge, date);

    const title = document.createElement("h4");
    title.textContent = schedule.subject
      ? `${schedule.subject} · ${schedule.title}`
      : schedule.title;
    card.append(top, title);
    appendClassTags(card, schedule.classTags);

    if (schedule.examScope) {
      const scope = document.createElement("p");
      scope.className = "calendar-schedule-scope";
      const label = document.createElement("strong");
      label.textContent = "시험 범위 ";
      scope.append(label, document.createTextNode(schedule.examScope));
      card.appendChild(scope);
    }
    if (schedule.description) {
      const description = document.createElement("p");
      description.className = "calendar-schedule-description";
      description.textContent = schedule.description;
      card.appendChild(description);
    }

    list.appendChild(card);
  }
  calendarScheduleList.appendChild(list);
}

function renderScheduleChips(schedules) {
  document.querySelectorAll(".calendar-day[data-date]").forEach((day) => {
    const date = day.dataset.date;
    const matches = schedules.filter(
      (schedule) => schedule.startsOn <= date && schedule.endsOn >= date,
    );
    for (const schedule of matches) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `calendar-schedule-chip schedule-${schedule.type.toLowerCase()}`;
      const classLabel = Array.isArray(schedule.classTags) && schedule.classTags.length
        ? `[${schedule.classTags.join(", ")}] `
        : "";
      chip.textContent = classLabel + (schedule.subject
        ? `${schedule.subject} · ${schedule.title}`
        : schedule.title);
      chip.title = `${formatDateRange(schedule)} ${chip.textContent}`;
      chip.addEventListener("click", () => {
        const card = document.getElementById(`schedule-${schedule.id}`);
        if (!card) return;
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.classList.add("calendar-schedule-active");
        window.setTimeout(() => card.classList.remove("calendar-schedule-active"), 1400);
      });
      day.appendChild(chip);
    }
  });
}

async function loadSchedules() {
  const currentRequest = ++requestNumber;
  const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const last = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
  calendarScheduleList.innerHTML = '<p class="loading">일정을 불러오는 중...</p>';

  try {
    const params = new URLSearchParams({ from: toDateString(first), to: toDateString(last) });
    const response = await fetch(`/api/club-schedules?${params}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error(`API 응답 오류: ${response.status}`);
    const schedules = await response.json();
    if (currentRequest !== requestNumber) return;
    renderScheduleChips(schedules);
    renderScheduleList(schedules);
  } catch {
    if (currentRequest !== requestNumber) return;
    calendarScheduleList.innerHTML = '<p class="error">일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>';
  }
}

function setProposalMessage(message, kind = "") {
  if (!proposalMessage) return;
  proposalMessage.textContent = message;
  proposalMessage.className = kind;
}

function getErrorMessage(response, fallback) {
  return response.json()
    .then((body) => Array.isArray(body.message) ? body.message.join(" ") : body.message || fallback)
    .catch(() => fallback);
}

async function submitProposal(event) {
  event.preventDefault();
  if (!proposalForm || !proposalSubmit) return;

  const startsOn = document.getElementById("schedule-start").value;
  const endsOn = document.getElementById("schedule-end").value;
  if (endsOn < startsOn) {
    setProposalMessage("종료일은 시작일보다 빠를 수 없습니다.", "error");
    return;
  }

  const classTags = Array.from(
    proposalForm.querySelectorAll('input[name="schedule-class"]:checked'),
    (input) => input.value,
  );
  const payload = {
    type: document.getElementById("schedule-type").value,
    subject: document.getElementById("schedule-subject").value,
    title: document.getElementById("schedule-title").value,
    classTags,
    startsOn,
    endsOn,
    examScope: document.getElementById("schedule-scope").value,
    description: document.getElementById("schedule-description").value,
  };

  proposalSubmit.disabled = true;
  setProposalMessage("승인 요청을 보내는 중...");
  try {
    const response = await fetch("/api/club-schedules", {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await getErrorMessage(response, "일정을 제안하지 못했습니다."));
    proposalForm.reset();
    document.getElementById("schedule-start").value = toDateString(today);
    document.getElementById("schedule-end").value = toDateString(today);
    setProposalMessage("제안이 접수되었습니다. hift가 승인하면 달력에 표시됩니다.", "success");
    if (approvalSection && !approvalSection.hidden) void loadPendingSchedules();
  } catch (error) {
    setProposalMessage(error.message || "일정을 제안하지 못했습니다.", "error");
  } finally {
    proposalSubmit.disabled = false;
  }
}

function renderPendingSchedules(schedules) {
  if (!approvalList) return;
  approvalList.innerHTML = "";
  approvalList.className = "calendar-approval-list";
  if (schedules.length === 0) {
    const empty = document.createElement("p");
    empty.className = "calendar-approval-meta";
    empty.textContent = "승인 대기 중인 일정이 없습니다.";
    approvalList.appendChild(empty);
    return;
  }

  for (const schedule of schedules) {
    const card = document.createElement("article");
    card.className = "calendar-approval-card";

    const meta = document.createElement("p");
    meta.className = "calendar-approval-meta";
    meta.textContent = `${schedule.proposedBy || "알 수 없음"} 제안 · ${formatDateRange(schedule)} · ${schedule.type === "EXAM" ? "시험" : "수행평가"}`;
    const title = document.createElement("h4");
    title.textContent = schedule.subject ? `${schedule.subject} · ${schedule.title}` : schedule.title;
    card.append(meta, title);
    appendClassTags(card, schedule.classTags);

    if (schedule.examScope) {
      const detail = document.createElement("p");
      detail.className = "calendar-approval-detail";
      detail.textContent = `범위: ${schedule.examScope}`;
      card.appendChild(detail);
    }
    if (schedule.description) {
      const detail = document.createElement("p");
      detail.className = "calendar-approval-detail";
      detail.textContent = schedule.description;
      card.appendChild(detail);
    }

    const actions = document.createElement("div");
    actions.className = "calendar-approval-actions";
    const approve = document.createElement("button");
    approve.type = "button";
    approve.className = "btn btn-primary";
    approve.textContent = "승인";
    approve.addEventListener("click", () => reviewSchedule(schedule.id, "approve", approve, reject));
    const reject = document.createElement("button");
    reject.type = "button";
    reject.className = "btn btn-danger";
    reject.textContent = "반려";
    reject.addEventListener("click", () => reviewSchedule(schedule.id, "reject", approve, reject));
    actions.append(approve, reject);
    card.appendChild(actions);
    approvalList.appendChild(card);
  }
}

async function loadPendingSchedules() {
  if (!approvalList) return;
  approvalList.className = "";
  approvalList.innerHTML = '<p class="loading">승인 대기 일정을 불러오는 중...</p>';
  try {
    const response = await fetch("/api/club-schedules/pending", { headers: getAuthHeaders() });
    if (!response.ok) throw new Error(await getErrorMessage(response, "승인 대기 일정을 불러오지 못했습니다."));
    renderPendingSchedules(await response.json());
  } catch (error) {
    approvalList.innerHTML = "";
    const message = document.createElement("p");
    message.className = "error";
    message.textContent = error.message || "승인 대기 일정을 불러오지 못했습니다.";
    approvalList.appendChild(message);
  }
}

async function reviewSchedule(id, action, approveButton, rejectButton) {
  let reason = "";
  if (action === "reject") {
    const entered = window.prompt("반려 사유를 입력해주세요. (선택)", "");
    if (entered === null) return;
    reason = entered;
  }
  approveButton.disabled = true;
  rejectButton.disabled = true;
  try {
    const response = await fetch(`/api/club-schedules/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify(action === "reject" ? { reason } : {}),
    });
    if (!response.ok) throw new Error(await getErrorMessage(response, "일정을 처리하지 못했습니다."));
    await loadPendingSchedules();
    if (action === "approve") refreshCalendar();
  } catch (error) {
    window.alert(error.message || "일정을 처리하지 못했습니다.");
    approveButton.disabled = false;
    rejectButton.disabled = false;
  }
}

function refreshCalendar() {
  renderCalendar();
  void loadSchedules();
}

if (
  calendarMonth &&
  calendarGrid &&
  calendarPrev &&
  calendarToday &&
  calendarNext &&
  calendarScheduleList
) {
  calendarPrev.addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    refreshCalendar();
  });

  calendarToday.addEventListener("click", () => {
    visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    refreshCalendar();
  });

  calendarNext.addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    refreshCalendar();
  });

  refreshCalendar();

  const dateToday = toDateString(today);
  document.getElementById("schedule-start").value = dateToday;
  document.getElementById("schedule-end").value = dateToday;
  proposalForm?.addEventListener("submit", submitProposal);
  approvalRefresh?.addEventListener("click", () => void loadPendingSchedules());

  window.clubProfileReady?.then((profile) => {
    if (profile?.username !== "hift" || !approvalSection) return;
    approvalSection.hidden = false;
    void loadPendingSchedules();
  });
}
