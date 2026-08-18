const calendarMonth = document.getElementById("calendar-month");
const calendarGrid = document.getElementById("calendar-grid");
const calendarPrev = document.getElementById("calendar-prev");
const calendarToday = document.getElementById("calendar-today");
const calendarNext = document.getElementById("calendar-next");

const today = new Date();
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);

function isSameDate(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
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

if (calendarMonth && calendarGrid && calendarPrev && calendarToday && calendarNext) {
  calendarPrev.addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    renderCalendar();
  });

  calendarToday.addEventListener("click", () => {
    visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    renderCalendar();
  });

  calendarNext.addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  renderCalendar();
}
