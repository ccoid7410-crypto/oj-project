import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import './calendar.css';

// club-homepage/js/calendar.js를 그대로 React로 옮긴 것이다. 알고리즘(다중일 이벤트
// 바 레인 배치)과 API 계약은 원본과 동일하게 유지했다.

type ScheduleType = 'ASSESSMENT' | 'EXAM' | 'EVENT' | 'OTHER' | 'VACATION' | 'CUSTOM';

interface ClubSchedule {
  id: string;
  type: ScheduleType;
  customType: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  title: string;
  subject: string | null;
  classTags: string[];
  description: string | null;
  examScope: string | null;
  deadlineTime: string | null;
  startsOn: string;
  endsOn: string;
  proposedBy?: string | null;
}

const BUILTIN_TYPES: { value: ScheduleType; label: string }[] = [
  { value: 'EXAM', label: '시험' },
  { value: 'ASSESSMENT', label: '수행평가' },
  { value: 'EVENT', label: '행사 및 축제' },
  { value: 'VACATION', label: '방학' },
  { value: 'OTHER', label: '기타' },
];

const CLASS_TAG_OPTIONS = ['1반', '2반', '3반'];

const CUSTOM_COLORS = ['#1f9e8f', '#c2185b', '#8d6e63', '#5c6bc0', '#d08700', '#7cb342'];

function isSameDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateRange(schedule: ClubSchedule) {
  if (schedule.type === 'ASSESSMENT') {
    return `${schedule.startsOn}${schedule.deadlineTime ? ` ${schedule.deadlineTime} 마감` : ''}`;
  }
  const range =
    schedule.startsOn === schedule.endsOn ? schedule.startsOn : `${schedule.startsOn} ~ ${schedule.endsOn}`;
  if ((schedule.type === 'EVENT' || schedule.type === 'OTHER') && schedule.deadlineTime) {
    return `${range} ${schedule.deadlineTime} 종료`;
  }
  return range;
}

function scheduleTypeLabel(type: ScheduleType, customType: string | null) {
  if (type === 'CUSTOM') return customType || '기타';
  return BUILTIN_TYPES.find((t) => t.value === type)?.label || '기타';
}

/** 사용자 정의 종류는 이름을 해시해서 팔레트에서 색을 고른다(같은 이름이면 항상 같은 색). */
function customTypeColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return CUSTOM_COLORS[hash % CUSTOM_COLORS.length];
}

function scheduleColorStyle(schedule: ClubSchedule): string {
  return schedule.type === 'CUSTOM' ? customTypeColor(schedule.customType || '') : '';
}

function scheduleTitle(schedule: ClubSchedule) {
  const usesSubject = schedule.type === 'ASSESSMENT' || schedule.type === 'EXAM';
  return usesSubject && schedule.subject ? `${schedule.subject} · ${schedule.title}` : schedule.title;
}

/** "EXAM" | "CUSTOM:<이름>" | "__NEW__" 형태인 select 값을 실제 종류로 풀어낸다. */
function parseRawType(raw: string) {
  const isNewType = raw === '__NEW__';
  const type: ScheduleType = isNewType || raw.startsWith('CUSTOM:') ? 'CUSTOM' : (raw as ScheduleType);
  const customTypeName = isNewType ? '' : raw.startsWith('CUSTOM:') ? raw.slice('CUSTOM:'.length) : '';
  const isAssessment = type === 'ASSESSMENT';
  const isExam = type === 'EXAM';
  const usesSubject = isAssessment || isExam;
  return { isNewType, type, customTypeName, isAssessment, isExam, usesSubject };
}

function dayColumnIndex(weekDates: Date[], dateStr: string) {
  for (let index = 0; index < weekDates.length; index += 1) {
    if (toDateString(weekDates[index]) === dateStr) return index;
  }
  return 0;
}

interface BarSegment {
  schedule: ClubSchedule;
  startCol: number;
  endCol: number;
  continuesLeft: boolean;
  continuesRight: boolean;
  lane: number;
}

/** 갤럭시 캘린더처럼, 한 주 안에서 여러 날에 걸친 일정을 겹치지 않는 레인에 배치한다. */
function computeWeekSegments(weekDates: Date[], schedules: ClubSchedule[]) {
  const weekStart = toDateString(weekDates[0]);
  const weekEnd = toDateString(weekDates[6]);

  const segments: BarSegment[] = [];
  for (const schedule of schedules) {
    if (schedule.endsOn < weekStart || schedule.startsOn > weekEnd) continue;
    segments.push({
      schedule,
      startCol: schedule.startsOn <= weekStart ? 0 : dayColumnIndex(weekDates, schedule.startsOn),
      endCol: schedule.endsOn >= weekEnd ? 6 : dayColumnIndex(weekDates, schedule.endsOn),
      continuesLeft: schedule.startsOn < weekStart,
      continuesRight: schedule.endsOn > weekEnd,
      lane: 0,
    });
  }
  // 시작 칸이 빠른 순, 같으면 더 긴 일정 먼저 → 레인(줄) 배치가 안정적이다.
  segments.sort((a, b) => a.startCol - b.startCol || b.endCol - a.endCol);

  const laneEnds: number[] = [];
  let maxLane = -1;
  for (const seg of segments) {
    let lane = 0;
    while (lane < laneEnds.length && laneEnds[lane] >= seg.startCol) lane += 1;
    laneEnds[lane] = seg.endCol;
    seg.lane = lane;
    if (lane > maxLane) maxLane = lane;
  }
  return { segments, lanes: maxLane + 1 };
}

function buildMonthWeeks(visibleMonth: Date): Date[][] {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstDay.getDay());

  const weeks: Date[][] = [];
  for (let week = 0; week < 6; week += 1) {
    const days: Date[] = [];
    for (let col = 0; col < 7; col += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + week * 7 + col);
      days.push(date);
    }
    weeks.push(days);
  }
  return weeks;
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

interface ProposalForm {
  rawType: string;
  customTypeName: string;
  subject: string;
  title: string;
  classTags: string[];
  startsOn: string;
  endsOn: string;
  deadlineTime: string;
  examScope: string;
  description: string;
}

function emptyProposalForm(today: Date): ProposalForm {
  const dateToday = toDateString(today);
  return {
    rawType: BUILTIN_TYPES[0].value,
    customTypeName: '',
    subject: '',
    title: '',
    classTags: [],
    startsOn: dateToday,
    endsOn: dateToday,
    deadlineTime: '23:59',
    examScope: '',
    description: '',
  };
}

export function ClubCalendarPage() {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const canManage = user?.username === 'hift';

  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [schedules, setSchedules] = useState<ClubSchedule[] | null>(null);
  const [schedulesError, setSchedulesError] = useState<string | null>(null);
  const requestNumber = useRef(0);

  const [customTypes, setCustomTypes] = useState<string[]>([]);

  const [proposalOpen, setProposalOpen] = useState(false);
  const [form, setForm] = useState<ProposalForm>(() => emptyProposalForm(today));
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [proposalMessage, setProposalMessage] = useState<{ text: string; kind: '' | 'success' | 'error' }>({
    text: '',
    kind: '',
  });

  const [pending, setPending] = useState<ClubSchedule[] | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const [flashId, setFlashId] = useState<string | null>(null);

  const weeks = useMemo(() => buildMonthWeeks(visibleMonth), [visibleMonth]);

  const loadSchedules = useCallback(async () => {
    const currentRequest = (requestNumber.current += 1);
    setSchedulesError(null);
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const last = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
    try {
      const params = new URLSearchParams({ from: toDateString(first), to: toDateString(last) });
      const data = await api.get<ClubSchedule[]>(`/club-schedules?${params}`);
      if (currentRequest !== requestNumber.current) return;
      setSchedules(data);
    } catch {
      if (currentRequest !== requestNumber.current) return;
      setSchedules(null);
      setSchedulesError('일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  }, [visibleMonth]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const loadCustomTypes = useCallback(async () => {
    try {
      setCustomTypes(await api.get<string[]>('/club-schedules/custom-types'));
    } catch {
      // 목록을 못 받아도 기본 종류만으로 동작한다.
    }
  }, []);

  useEffect(() => {
    void loadCustomTypes();
  }, [loadCustomTypes]);

  const loadPending = useCallback(async () => {
    setPendingError(null);
    try {
      setPending(await api.get<ClubSchedule[]>('/club-schedules/pending'));
    } catch (err) {
      setPending(null);
      setPendingError(errorMessage(err, '승인 대기 일정을 불러오지 못했습니다.'));
    }
  }, []);

  useEffect(() => {
    if (canManage) void loadPending();
  }, [canManage, loadPending]);

  function resetProposalForm() {
    setForm(emptyProposalForm(today));
    setEditingScheduleId(null);
  }

  function beginScheduleEdit(schedule: ClubSchedule) {
    setEditingScheduleId(schedule.id);
    setForm({
      rawType: schedule.type === 'CUSTOM' ? `CUSTOM:${schedule.customType}` : schedule.type,
      customTypeName: '',
      subject: schedule.subject ?? '',
      title: schedule.title,
      classTags: schedule.classTags,
      startsOn: schedule.startsOn,
      endsOn: schedule.endsOn,
      deadlineTime: schedule.deadlineTime || '23:59',
      examScope: schedule.examScope ?? '',
      description: schedule.description ?? '',
    });
    setProposalMessage({ text: '승인된 일정을 수정하고 있습니다.', kind: '' });
    setProposalOpen(true);
  }

  async function onSubmitProposal(e: FormEvent) {
    e.preventDefault();
    const { isNewType, type, customTypeName: parsedCustomName, isAssessment, usesSubject } = parseRawType(
      form.rawType,
    );
    const customTypeName = isNewType ? form.customTypeName.trim() : parsedCustomName;
    if (type === 'CUSTOM' && !customTypeName) {
      setProposalMessage({ text: '새 종류의 이름을 입력해주세요.', kind: 'error' });
      return;
    }
    const endsOn = isAssessment ? form.startsOn : form.endsOn;
    if (!isAssessment && endsOn < form.startsOn) {
      setProposalMessage({ text: '종료일은 시작일보다 빠를 수 없습니다.', kind: 'error' });
      return;
    }

    const payload = {
      type,
      customType: customTypeName || undefined,
      subject: usesSubject ? form.subject : '',
      title: form.title,
      classTags: form.classTags,
      startsOn: form.startsOn,
      endsOn,
      deadlineTime: isAssessment ? form.deadlineTime : undefined,
      examScope: form.examScope,
      description: form.description,
    };

    setSubmitting(true);
    setProposalMessage({ text: editingScheduleId ? '일정을 수정하는 중...' : '승인 요청을 보내는 중...', kind: '' });
    try {
      if (editingScheduleId) {
        await api.put(`/club-schedules/${encodeURIComponent(editingScheduleId)}`, payload);
      } else {
        await api.post('/club-schedules', payload);
      }
      const wasEditing = Boolean(editingScheduleId);
      resetProposalForm();
      setProposalMessage({
        text: wasEditing ? '일정을 수정했습니다.' : '제안이 접수되었습니다. 관리자가 승인하면 달력에 표시됩니다.',
        kind: 'success',
      });
      if (wasEditing) void loadSchedules();
      if (canManage) void loadPending();
    } catch (err) {
      setProposalMessage({ text: errorMessage(err, '일정을 제안하지 못했습니다.'), kind: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  async function onDeleteSchedule(schedule: ClubSchedule) {
    if (!window.confirm(`'${schedule.title}' 일정을 삭제할까요?`)) return;
    try {
      await api.delete(`/club-schedules/${encodeURIComponent(schedule.id)}`);
      if (editingScheduleId === schedule.id) resetProposalForm();
      void loadSchedules();
    } catch (err) {
      window.alert(errorMessage(err, '일정을 삭제하지 못했습니다.'));
    }
  }

  async function onReviewSchedule(id: string, action: 'approve' | 'reject') {
    let reason = '';
    if (action === 'reject') {
      const entered = window.prompt('반려 사유를 입력해주세요. (선택)', '');
      if (entered === null) return;
      reason = entered;
    }
    setReviewingId(id);
    try {
      await api.post(`/club-schedules/${encodeURIComponent(id)}/${action}`, action === 'reject' ? { reason } : {});
      await loadPending();
      if (action === 'approve') {
        // 승인된 순간부터 그 종류가 목록·범례에 노출된다.
        void loadCustomTypes();
        void loadSchedules();
      }
    } catch (err) {
      window.alert(errorMessage(err, '일정을 처리하지 못했습니다.'));
    } finally {
      setReviewingId(null);
    }
  }

  function focusScheduleCard(id: string) {
    document.getElementById(`schedule-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlashId(id);
    window.setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1400);
  }

  const { isNewType, isAssessment, usesSubject } = parseRawType(form.rawType);

  const typeSelectOptions = (
    <>
      {BUILTIN_TYPES.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label}
        </option>
      ))}
      {customTypes.map((name) => (
        <option key={name} value={`CUSTOM:${name}`}>
          {name}
        </option>
      ))}
      <option value="__NEW__">+ 새 종류 만들기</option>
    </>
  );

  return (
    <section className="calendar-section">
      <div className="calendar-page-header">
        <div>
          <h2>일정</h2>
          <p>수행평가, 시험, 행사와 학교 일정을 한눈에 확인하세요.</p>
        </div>
        <div className="calendar-controls">
          <button
            type="button"
            aria-label="이전 달"
            onClick={() => setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          >
            ‹
          </button>
          <button type="button" onClick={() => setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>
            오늘
          </button>
          <button
            type="button"
            aria-label="다음 달"
            onClick={() => setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          >
            ›
          </button>
        </div>
      </div>

      <section className="calendar-proposal-panel" aria-labelledby="calendar-proposal-title">
        <div className="calendar-panel-heading">
          <div>
            <h3 id="calendar-proposal-title">일정 제안</h3>
            <p>부원 누구나 일정을 제안할 수 있습니다. 관리자가 승인하면 달력에 공개됩니다.</p>
          </div>
          <button type="button" className="btn btn-ghost" aria-expanded={proposalOpen} onClick={() => setProposalOpen((v) => !v)}>
            {proposalOpen ? '접기' : '펼치기'}
          </button>
        </div>
        {proposalOpen && (
          <form className="calendar-proposal-form" onSubmit={onSubmitProposal}>
            <label className="calendar-field">
              <span>종류</span>
              <select
                className="field-select"
                required
                value={form.rawType}
                onChange={(e) => setForm((f) => ({ ...f, rawType: e.target.value }))}
              >
                {typeSelectOptions}
              </select>
            </label>
            {isNewType && (
              <label className="calendar-field">
                <span>새 종류 이름</span>
                <input
                  className="field-input"
                  type="text"
                  maxLength={20}
                  placeholder="예: 봉사활동"
                  required
                  value={form.customTypeName}
                  onChange={(e) => setForm((f) => ({ ...f, customTypeName: e.target.value }))}
                />
              </label>
            )}
            {usesSubject && (
              <label className="calendar-field">
                <span>과목</span>
                <input
                  className="field-input"
                  type="text"
                  maxLength={50}
                  placeholder="예: 수학"
                  required
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                />
              </label>
            )}
            <label className="calendar-field calendar-field-wide">
              <span>일정 제목</span>
              <input
                className="field-input"
                type="text"
                maxLength={100}
                placeholder="예: 확률과 통계 수행평가"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <fieldset className="calendar-class-picker calendar-field-wide">
              <legend>반 태그</legend>
              {CLASS_TAG_OPTIONS.map((tag) => (
                <label key={tag}>
                  <input
                    type="checkbox"
                    checked={form.classTags.includes(tag)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        classTags: e.target.checked ? [...f.classTags, tag] : f.classTags.filter((t) => t !== tag),
                      }))
                    }
                  />{' '}
                  {tag}
                </label>
              ))}
            </fieldset>
            <label className="calendar-field">
              <span>{isAssessment ? '날짜' : '시작일'}</span>
              <input
                className="field-input"
                type="date"
                required
                value={form.startsOn}
                onChange={(e) => setForm((f) => ({ ...f, startsOn: e.target.value }))}
              />
            </label>
            {!isAssessment && (
              <label className="calendar-field">
                <span>종료일</span>
                <input
                  className="field-input"
                  type="date"
                  required
                  value={form.endsOn}
                  onChange={(e) => setForm((f) => ({ ...f, endsOn: e.target.value }))}
                />
              </label>
            )}
            {isAssessment && (
              <label className="calendar-field">
                <span>마감 시간</span>
                <input
                  className="field-input"
                  type="time"
                  required
                  value={form.deadlineTime}
                  onChange={(e) => setForm((f) => ({ ...f, deadlineTime: e.target.value }))}
                />
              </label>
            )}
            <label className="calendar-field calendar-field-wide">
              <span>범위</span>
              <textarea
                className="field-textarea"
                maxLength={1000}
                rows={3}
                placeholder="시험이나 수행평가 범위를 적어주세요."
                value={form.examScope}
                onChange={(e) => setForm((f) => ({ ...f, examScope: e.target.value }))}
              />
            </label>
            <label className="calendar-field calendar-field-wide">
              <span>추가 설명</span>
              <textarea
                className="field-textarea"
                maxLength={1000}
                rows={3}
                placeholder="준비물 등 추가 안내가 있다면 적어주세요."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <div className="calendar-proposal-actions calendar-field-wide">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {editingScheduleId ? '수정 저장' : '승인 요청하기'}
              </button>
              {editingScheduleId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    resetProposalForm();
                    setProposalMessage({ text: '', kind: '' });
                  }}
                >
                  수정 취소
                </button>
              )}
              <p aria-live="polite" className={proposalMessage.kind}>
                {proposalMessage.text}
              </p>
            </div>
          </form>
        )}
      </section>

      {canManage && (
        <section className="calendar-approval-panel" aria-labelledby="schedule-approval-title">
          <div className="calendar-panel-heading">
            <div>
              <h3 id="schedule-approval-title">승인 대기 일정</h3>
              <p>관리자가 승인한 일정만 아래 달력에 표시됩니다.</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => void loadPending()}>
              새로고침
            </button>
          </div>
          <div aria-live="polite">
            {pendingError ? (
              <p className="error">{pendingError}</p>
            ) : pending === null ? (
              <p className="loading">승인 대기 일정을 불러오는 중...</p>
            ) : pending.length === 0 ? (
              <p className="calendar-approval-meta">승인 대기 중인 일정이 없습니다.</p>
            ) : (
              <div className="calendar-approval-list">
                {pending.map((schedule) => (
                  <article key={schedule.id} className="calendar-approval-card">
                    <p className="calendar-approval-meta">
                      {schedule.proposedBy || '알 수 없음'} 제안 · {formatDateRange(schedule)} ·{' '}
                      {scheduleTypeLabel(schedule.type, schedule.customType)}
                    </p>
                    <h4>{scheduleTitle(schedule)}</h4>
                    {schedule.classTags.length > 0 && (
                      <div className="calendar-class-tags">
                        {schedule.classTags.map((tag) => (
                          <span key={tag} className="calendar-class-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {schedule.examScope && <p className="calendar-approval-detail">범위: {schedule.examScope}</p>}
                    {schedule.description && <p className="calendar-approval-detail">{schedule.description}</p>}
                    <div className="calendar-approval-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={reviewingId === schedule.id}
                        onClick={() => void onReviewSchedule(schedule.id, 'approve')}
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={reviewingId === schedule.id}
                        onClick={() => void onReviewSchedule(schedule.id, 'reject')}
                      >
                        반려
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <div className="calendar-month-row">
        <h3>
          {visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월
        </h3>
        <div className="calendar-legend" aria-label="일정 종류">
          {BUILTIN_TYPES.map((t) => (
            <span key={t.value}>
              <i className={`legend-dot legend-${t.value.toLowerCase()}`} />
              {t.label}
            </span>
          ))}
          {customTypes.map((name) => (
            <span key={name}>
              <i className="legend-dot" style={{ background: customTypeColor(name) }} />
              {name}
            </span>
          ))}
        </div>
      </div>

      <div className="calendar-scroll">
        <div className="calendar" aria-label="월간 일정 달력">
          <div className="calendar-weekdays" aria-hidden="true">
            <span>일</span>
            <span>월</span>
            <span>화</span>
            <span>수</span>
            <span>목</span>
            <span>금</span>
            <span>토</span>
          </div>
          <div className="calendar-grid">
            {weeks.map((weekDates, weekIndex) => {
              const { segments, lanes } = computeWeekSegments(weekDates, schedules ?? []);
              return (
                <div key={weekIndex} className="calendar-week" style={{ '--lanes': lanes } as CSSProperties}>
                  <div className="calendar-week-days">
                    {weekDates.map((date) => {
                      const outside = date.getMonth() !== visibleMonth.getMonth();
                      const isToday = isSameDate(date, today);
                      const classes = [
                        'calendar-day',
                        outside && 'calendar-day-outside',
                        date.getDay() === 0 && 'calendar-day-sunday',
                        date.getDay() === 6 && 'calendar-day-saturday',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      const numberClasses = ['calendar-day-number', isToday && 'calendar-day-today']
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <div
                          key={toDateString(date)}
                          className={classes}
                          data-date={toDateString(date)}
                          aria-current={isToday ? 'date' : undefined}
                        >
                          <span className={numberClasses}>{date.getDate()}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="calendar-week-bars">
                    {segments.map((seg) => {
                      const span = seg.endCol - seg.startCol + 1;
                      const barColor = scheduleColorStyle(seg.schedule);
                      const classLabel =
                        seg.schedule.classTags.length > 0 ? `[${seg.schedule.classTags.join(', ')}] ` : '';
                      const label = classLabel + scheduleTitle(seg.schedule);
                      const barClasses = [
                        'calendar-bar',
                        `schedule-${seg.schedule.type.toLowerCase()}`,
                        seg.continuesLeft && 'bar-continues-left',
                        seg.continuesRight && 'bar-continues-right',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <button
                          key={seg.schedule.id}
                          type="button"
                          className={barClasses}
                          style={
                            {
                              left: `calc(${seg.startCol} / 7 * 100% + 2px)`,
                              width: `calc(${span} / 7 * 100% - 4px)`,
                              top: `calc(${seg.lane} * 22px)`,
                              ...(barColor ? { '--schedule-color': barColor } : {}),
                            } as CSSProperties
                          }
                          title={`${formatDateRange(seg.schedule)} ${label}`}
                          onClick={() => focusScheduleCard(seg.schedule.id)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="calendar-schedule-list" aria-live="polite">
        {schedulesError ? (
          <p className="error">{schedulesError}</p>
        ) : schedules === null ? (
          <p className="loading">일정을 불러오는 중...</p>
        ) : schedules.length === 0 ? (
          <div className="calendar-empty">
            <strong>이 달에 등록된 일정이 없습니다.</strong>
            <p>관리자가 일정을 등록하면 달력에 표시됩니다.</p>
          </div>
        ) : (
          <>
            <h3 className="calendar-list-heading">이 달의 일정</h3>
            <div className="calendar-list">
              {schedules.map((schedule) => {
                const barColor = scheduleColorStyle(schedule);
                return (
                  <article
                    key={schedule.id}
                    id={`schedule-${schedule.id}`}
                    className={`calendar-schedule-card schedule-${schedule.type.toLowerCase()}${
                      flashId === schedule.id ? ' calendar-schedule-active' : ''
                    }`}
                    style={barColor ? ({ '--schedule-color': barColor } as CSSProperties) : undefined}
                  >
                    <div className="calendar-schedule-top">
                      <span className="calendar-schedule-badge">{scheduleTypeLabel(schedule.type, schedule.customType)}</span>
                      <time>{formatDateRange(schedule)}</time>
                    </div>
                    <h4>{scheduleTitle(schedule)}</h4>
                    {schedule.classTags.length > 0 && (
                      <div className="calendar-class-tags">
                        {schedule.classTags.map((tag) => (
                          <span key={tag} className="calendar-class-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {schedule.examScope && (
                      <p className="calendar-schedule-scope">
                        <strong>범위 </strong>
                        {schedule.examScope}
                      </p>
                    )}
                    {schedule.description && <p className="calendar-schedule-description">{schedule.description}</p>}
                    {canManage && (
                      <div className="calendar-schedule-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => beginScheduleEdit(schedule)}>
                          수정
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => void onDeleteSchedule(schedule)}
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
