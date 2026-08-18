const calendarMonth = document.getElementById("calendar-month");
const calendarGrid = document.getElementById("calendar-grid");
const calendarPrev = document.getElementById("calendar-prev");
const calendarToday = document.getElementById("calendar-today");
const calendarNext = document.getElementById("calendar-next");
const calendarScheduleList = document.getElementById("calendar-schedule-list");

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
      chip.textContent = schedule.subject
        ? `${schedule.subject} · ${schedule.title}`
        : schedule.title;
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
    const token = localStorage.getItem("oj_token");
    const params = new URLSearchParams({ from: toDateString(first), to: toDateString(last) });
    const response = await fetch(`/api/club-schedules?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
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
}
