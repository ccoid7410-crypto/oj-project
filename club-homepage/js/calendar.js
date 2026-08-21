const calendarMonth = document.getElementById("calendar-month");
const calendarGrid = document.getElementById("calendar-grid");
const calendarPrev = document.getElementById("calendar-prev");
const calendarToday = document.getElementById("calendar-today");
const calendarNext = document.getElementById("calendar-next");
const calendarScheduleList = document.getElementById("calendar-schedule-list");
const proposalForm = document.getElementById("schedule-proposal-form");
const proposalMessage = document.getElementById("schedule-proposal-message");
const proposalSubmit = document.getElementById("schedule-submit");
const proposalToggle = document.getElementById("schedule-proposal-toggle");
const editCancel = document.getElementById("schedule-edit-cancel");
const scheduleType = document.getElementById("schedule-type");
const scheduleSubjectField = document.getElementById("schedule-subject-field");
const scheduleSubject = document.getElementById("schedule-subject");
const scheduleStartField = document.getElementById("schedule-start-field");
const scheduleStartLabel = document.getElementById("schedule-start-label");
const scheduleEndField = document.getElementById("schedule-end-field");
const scheduleEndLabel = document.getElementById("schedule-end-label");
const scheduleDeadlineField = document.getElementById("schedule-deadline-field");
const scheduleDeadlineLabel = document.getElementById("schedule-deadline-label");
const scheduleDeadlineTime = document.getElementById("schedule-deadline-time");
const approvalSection = document.getElementById("schedule-approval-section");
const approvalList = document.getElementById("schedule-approval-list");
const approvalRefresh = document.getElementById("schedule-approval-refresh");

const today = new Date();
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let requestNumber = 0;
let canManageSchedules = false;
let editingScheduleId = null;

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
  if (schedule.type === "ASSESSMENT") {
    return `${schedule.startsOn}${schedule.deadlineTime ? ` ${schedule.deadlineTime} 마감` : ""}`;
  }
  const range = schedule.startsOn === schedule.endsOn
    ? schedule.startsOn
    : `${schedule.startsOn} ~ ${schedule.endsOn}`;
  if ((schedule.type === "EVENT" || schedule.type === "OTHER") && schedule.deadlineTime) {
    return `${range} ${schedule.deadlineTime} 종료`;
  }
  return range;
}

function scheduleTypeLabel(type) {
  return {
    ASSESSMENT: "수행평가",
    EXAM: "시험",
    EVENT: "행사 및 축제",
    OTHER: "기타",
    VACATION: "방학",
  }[type] || "기타";
}

function scheduleTitle(schedule) {
  const usesSubject = schedule.type === "ASSESSMENT" || schedule.type === "EXAM";
  return usesSubject && schedule.subject
    ? `${schedule.subject} · ${schedule.title}`
    : schedule.title;
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

  // 6주 × 7일. 주 단위로 묶어야 여러 날에 걸친 일정을 하나의 연속 바로 그릴 수 있다.
  for (let week = 0; week < 6; week += 1) {
    const weekRow = document.createElement("div");
    weekRow.className = "calendar-week";
    const daysRow = document.createElement("div");
    daysRow.className = "calendar-week-days";
    const barsLayer = document.createElement("div");
    barsLayer.className = "calendar-week-bars";

    for (let col = 0; col < 7; col += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + week * 7 + col);

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
      daysRow.appendChild(day);
    }

    weekRow.append(daysRow, barsLayer);
    calendarGrid.appendChild(weekRow);
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
    badge.textContent = scheduleTypeLabel(schedule.type);
    const date = document.createElement("time");
    date.textContent = formatDateRange(schedule);
    top.append(badge, date);

    const title = document.createElement("h4");
    title.textContent = scheduleTitle(schedule);
    card.append(top, title);
    appendClassTags(card, schedule.classTags);

    if (schedule.examScope) {
      const scope = document.createElement("p");
      scope.className = "calendar-schedule-scope";
      const label = document.createElement("strong");
      label.textContent = "범위 ";
      scope.append(label, document.createTextNode(schedule.examScope));
      card.appendChild(scope);
    }
    if (schedule.description) {
      const description = document.createElement("p");
      description.className = "calendar-schedule-description";
      description.textContent = schedule.description;
      card.appendChild(description);
    }

    if (canManageSchedules) {
      const actions = document.createElement("div");
      actions.className = "calendar-schedule-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "btn btn-ghost btn-sm";
      edit.textContent = "수정";
      edit.addEventListener("click", () => beginScheduleEdit(schedule));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn-danger btn-sm";
      remove.textContent = "삭제";
      remove.addEventListener("click", () => deleteSchedule(schedule));
      actions.append(edit, remove);
      card.appendChild(actions);
    }

    list.appendChild(card);
  }
  calendarScheduleList.appendChild(list);
}

function focusScheduleCard(id) {
  const card = document.getElementById(`schedule-${id}`);
  if (!card) return;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("calendar-schedule-active");
  window.setTimeout(() => card.classList.remove("calendar-schedule-active"), 1400);
}

// 여러 날에 걸친 일정을 갤럭시 캘린더처럼 주 단위로 이어진 하나의 바로 그린다.
// 주 경계를 넘어가면 다음 주 행에 이어서 표시하고, 잘린 쪽 끝은 각지게 처리한다.
function renderScheduleBars(schedules) {
  const weeks = calendarGrid.querySelectorAll(".calendar-week");
  weeks.forEach((weekRow) => {
    const barsLayer = weekRow.querySelector(".calendar-week-bars");
    const days = weekRow.querySelectorAll(".calendar-day[data-date]");
    barsLayer.innerHTML = "";
    if (days.length < 7) {
      weekRow.style.setProperty("--lanes", "0");
      return;
    }
    const weekStart = days[0].dataset.date;
    const weekEnd = days[6].dataset.date;

    const segments = [];
    for (const schedule of schedules) {
      if (schedule.endsOn < weekStart || schedule.startsOn > weekEnd) continue;
      segments.push({
        schedule,
        startCol: schedule.startsOn <= weekStart ? 0 : dayColumnIndex(days, schedule.startsOn),
        endCol: schedule.endsOn >= weekEnd ? 6 : dayColumnIndex(days, schedule.endsOn),
        continuesLeft: schedule.startsOn < weekStart,
        continuesRight: schedule.endsOn > weekEnd,
      });
    }
    // 시작 칸이 빠른 순, 같으면 더 긴 일정 먼저 → 레인(줄) 배치가 안정적이다.
    segments.sort((a, b) => a.startCol - b.startCol || b.endCol - a.endCol);

    const laneEnds = [];
    let maxLane = -1;
    for (const seg of segments) {
      let lane = 0;
      while (lane < laneEnds.length && laneEnds[lane] >= seg.startCol) lane += 1;
      laneEnds[lane] = seg.endCol;
      seg.lane = lane;
      if (lane > maxLane) maxLane = lane;
    }
    weekRow.style.setProperty("--lanes", String(maxLane + 1));

    for (const seg of segments) {
      const span = seg.endCol - seg.startCol + 1;
      const bar = document.createElement("button");
      bar.type = "button";
      bar.className = `calendar-bar schedule-${seg.schedule.type.toLowerCase()}`;
      if (seg.continuesLeft) bar.classList.add("bar-continues-left");
      if (seg.continuesRight) bar.classList.add("bar-continues-right");
      bar.style.left = `calc(${seg.startCol} / 7 * 100% + 2px)`;
      bar.style.width = `calc(${span} / 7 * 100% - 4px)`;
      bar.style.top = `calc(${seg.lane} * 22px)`;
      const classLabel = Array.isArray(seg.schedule.classTags) && seg.schedule.classTags.length
        ? `[${seg.schedule.classTags.join(", ")}] `
        : "";
      const label = classLabel + scheduleTitle(seg.schedule);
      bar.textContent = label;
      bar.title = `${formatDateRange(seg.schedule)} ${label}`;
      bar.addEventListener("click", () => focusScheduleCard(seg.schedule.id));
      barsLayer.appendChild(bar);
    }
  });
}

function dayColumnIndex(days, dateStr) {
  for (let index = 0; index < days.length; index += 1) {
    if (days[index].dataset.date === dateStr) return index;
  }
  return 0;
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
    renderScheduleBars(schedules);
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

function setProposalOpen(open) {
  if (!proposalForm || !proposalToggle) return;
  proposalForm.hidden = !open;
  proposalToggle.setAttribute("aria-expanded", String(open));
  proposalToggle.textContent = open ? "접기" : "펼치기";
}

function updateDateFields() {
  const type = scheduleType?.value;
  const isAssessment = type === "ASSESSMENT";
  const isExam = type === "EXAM";
  const usesSubject = isAssessment || isExam;

  // 수행평가는 단일 날짜 + 마감 시간, 나머지(시험/행사/기타/방학)는 시작일~종료일 범위.
  scheduleSubjectField.hidden = !usesSubject;
  scheduleSubject.required = usesSubject;
  scheduleStartLabel.textContent = isAssessment ? "날짜" : "시작일";
  scheduleEndField.hidden = isAssessment;
  scheduleDeadlineField.hidden = !isAssessment;

  const startInput = document.getElementById("schedule-start");
  const endInput = document.getElementById("schedule-end");
  startInput.required = true;
  endInput.required = !isAssessment;
  scheduleDeadlineTime.required = isAssessment;
}

function resetProposalForm() {
  if (!proposalForm) return;
  proposalForm.reset();
  const dateToday = toDateString(today);
  document.getElementById("schedule-start").value = dateToday;
  document.getElementById("schedule-end").value = dateToday;
  scheduleDeadlineTime.value = "23:59";
  editingScheduleId = null;
  proposalSubmit.textContent = "승인 요청하기";
  editCancel.hidden = true;
  updateDateFields();
}

function beginScheduleEdit(schedule) {
  editingScheduleId = schedule.id;
  scheduleType.value = schedule.type;
  document.getElementById("schedule-subject").value = schedule.subject;
  document.getElementById("schedule-title").value = schedule.title;
  document.getElementById("schedule-start").value = schedule.startsOn;
  document.getElementById("schedule-end").value = schedule.endsOn;
  scheduleDeadlineTime.value = schedule.deadlineTime || "23:59";
  document.getElementById("schedule-scope").value = schedule.examScope;
  document.getElementById("schedule-description").value = schedule.description;
  proposalForm.querySelectorAll('input[name="schedule-class"]').forEach((input) => {
    input.checked = schedule.classTags.includes(input.value);
  });
  proposalSubmit.textContent = "수정 저장";
  editCancel.hidden = false;
  setProposalMessage("승인된 일정을 수정하고 있습니다.");
  updateDateFields();
  setProposalOpen(true);
  proposalForm.scrollIntoView({ behavior: "smooth", block: "start" });
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
  const type = scheduleType.value;
  const isAssessment = type === "ASSESSMENT";
  const isExam = type === "EXAM";
  const usesSubject = isAssessment || isExam;
  const endsOn = isAssessment ? startsOn : document.getElementById("schedule-end").value;
  if (!isAssessment && endsOn < startsOn) {
    setProposalMessage("종료일은 시작일보다 빠를 수 없습니다.", "error");
    return;
  }

  const classTags = Array.from(
    proposalForm.querySelectorAll('input[name="schedule-class"]:checked'),
    (input) => input.value,
  );
  const payload = {
    type,
    subject: usesSubject ? scheduleSubject.value : "",
    title: document.getElementById("schedule-title").value,
    classTags,
    startsOn,
    endsOn,
    deadlineTime: isAssessment ? scheduleDeadlineTime.value : undefined,
    examScope: document.getElementById("schedule-scope").value,
    description: document.getElementById("schedule-description").value,
  };

  proposalSubmit.disabled = true;
  setProposalMessage(editingScheduleId ? "일정을 수정하는 중..." : "승인 요청을 보내는 중...");
  try {
    const url = editingScheduleId
      ? `/api/club-schedules/${encodeURIComponent(editingScheduleId)}`
      : "/api/club-schedules";
    const response = await fetch(url, {
      method: editingScheduleId ? "PUT" : "POST",
      headers: getAuthHeaders(true),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await getErrorMessage(response, "일정을 제안하지 못했습니다."));
    const wasEditing = Boolean(editingScheduleId);
    resetProposalForm();
    setProposalMessage(
      wasEditing
        ? "일정을 수정했습니다."
        : "제안이 접수되었습니다. 관리자가 승인하면 달력에 표시됩니다.",
      "success",
    );
    if (wasEditing) refreshCalendar();
    if (approvalSection && !approvalSection.hidden) void loadPendingSchedules();
  } catch (error) {
    setProposalMessage(error.message || "일정을 제안하지 못했습니다.", "error");
  } finally {
    proposalSubmit.disabled = false;
  }
}

async function deleteSchedule(schedule) {
  if (!window.confirm(`'${schedule.title}' 일정을 삭제할까요?`)) return;
  try {
    const response = await fetch(`/api/club-schedules/${encodeURIComponent(schedule.id)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error(await getErrorMessage(response, "일정을 삭제하지 못했습니다."));
    if (editingScheduleId === schedule.id) resetProposalForm();
    refreshCalendar();
  } catch (error) {
    window.alert(error.message || "일정을 삭제하지 못했습니다.");
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
    meta.textContent = `${schedule.proposedBy || "알 수 없음"} 제안 · ${formatDateRange(schedule)} · ${scheduleTypeLabel(schedule.type)}`;
    const title = document.createElement("h4");
    title.textContent = scheduleTitle(schedule);
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
  updateDateFields();
  scheduleType?.addEventListener("change", updateDateFields);
  proposalToggle?.addEventListener("click", () => setProposalOpen(proposalForm.hidden));
  proposalForm?.addEventListener("submit", submitProposal);
  editCancel?.addEventListener("click", () => {
    resetProposalForm();
    setProposalMessage("");
  });
  approvalRefresh?.addEventListener("click", () => void loadPendingSchedules());

  window.clubProfileReady?.then((profile) => {
    if (profile?.username !== "hift" || !approvalSection) return;
    canManageSchedules = true;
    approvalSection.hidden = false;
    void loadPendingSchedules();
    refreshCalendar();
  });
}
