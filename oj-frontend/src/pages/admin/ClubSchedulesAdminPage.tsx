import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';

type ScheduleType = 'ASSESSMENT' | 'EXAM' | 'EVENT' | 'OTHER';
type ScheduleStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type ClubSchedule = {
  id: string;
  type: ScheduleType;
  status: ScheduleStatus;
  title: string;
  subject: string;
  classTags: string[];
  description: string;
  examScope: string;
  deadlineTime: string;
  startsOn: string;
  endsOn: string;
  createdAt: string;
  updatedAt: string;
  rejectionReason: string;
  proposedBy: string | null;
};

type ScheduleForm = Pick<
  ClubSchedule,
  | 'type'
  | 'title'
  | 'subject'
  | 'classTags'
  | 'description'
  | 'examScope'
  | 'deadlineTime'
  | 'startsOn'
  | 'endsOn'
> & {
  includeStart: boolean;
  includeEndTime: boolean;
};

function localDateString() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function scheduleTypeLabel(type: ScheduleType) {
  return {
    ASSESSMENT: '수행평가',
    EXAM: '시험',
    EVENT: '행사 및 축제',
    OTHER: '기타',
  }[type];
}

function isFlexibleType(type: ScheduleType) {
  return type === 'EVENT' || type === 'OTHER';
}

function formatScheduleDate(schedule: ClubSchedule) {
  if (schedule.type === 'ASSESSMENT') {
    return `${schedule.startsOn}${schedule.deadlineTime ? ` ${schedule.deadlineTime} 마감` : ''}`;
  }
  const range = schedule.startsOn === schedule.endsOn
    ? schedule.startsOn
    : `${schedule.startsOn} ~ ${schedule.endsOn}`;
  return isFlexibleType(schedule.type) && schedule.deadlineTime
    ? `${range} ${schedule.deadlineTime} 종료`
    : range;
}

function emptyForm(): ScheduleForm {
  const today = localDateString();
  return {
    type: 'ASSESSMENT',
    title: '',
    subject: '',
    classTags: [],
    description: '',
    examScope: '',
    deadlineTime: '23:59',
    startsOn: today,
    endsOn: today,
    includeStart: false,
    includeEndTime: false,
  };
}

export function ClubSchedulesAdminPage() {
  const [schedules, setSchedules] = useState<ClubSchedule[]>([]);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setSchedules(await api.get<ClubSchedule[]>('/club-schedules/manage'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '일정 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function save() {
    if (!form.title.trim()) {
      setError('일정 제목을 입력해주세요.');
      return;
    }
    const flexible = isFlexibleType(form.type);
    const effectiveStartsOn = flexible && !form.includeStart ? form.endsOn : form.startsOn;
    if (form.type !== 'ASSESSMENT' && form.endsOn < effectiveStartsOn) {
      setError('종료일은 시작일과 같거나 뒤여야 합니다.');
      return;
    }
    if (form.type === 'ASSESSMENT' && !form.deadlineTime) {
      setError('수행평가 마감 시간을 입력해주세요.');
      return;
    }
    if (flexible && form.includeEndTime && !form.deadlineTime) {
      setError('종료 시간을 입력해주세요.');
      return;
    }

    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const { includeStart, includeEndTime, ...values } = form;
      const payload = {
        ...values,
        startsOn: flexible && !includeStart ? values.endsOn : values.startsOn,
        deadlineTime:
          form.type === 'ASSESSMENT' || (flexible && includeEndTime)
            ? values.deadlineTime
            : undefined,
      };
      if (editingId) {
        await api.put(`/club-schedules/${editingId}`, payload);
        setResult('일정을 수정했습니다.');
      } else {
        await api.post('/club-schedules', payload);
        setResult('일정을 제안했습니다. 관리자의 승인 후 달력에 표시됩니다.');
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '일정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  function edit(schedule: ClubSchedule) {
    setEditingId(schedule.id);
    setForm({
      type: schedule.type,
      title: schedule.title,
      subject: schedule.subject,
      classTags: schedule.classTags,
      description: schedule.description,
      examScope: schedule.examScope,
      deadlineTime: schedule.deadlineTime,
      startsOn: schedule.startsOn,
      endsOn: schedule.endsOn,
      includeStart: isFlexibleType(schedule.type) && schedule.startsOn !== schedule.endsOn,
      includeEndTime: isFlexibleType(schedule.type) && Boolean(schedule.deadlineTime),
    });
    setError(null);
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(schedule: ClubSchedule) {
    if (!confirm(`'${schedule.title}' 일정을 삭제할까요?`)) return;
    setError(null);
    setResult(null);
    try {
      await api.delete(`/club-schedules/${schedule.id}`);
      if (editingId === schedule.id) resetForm();
      setResult('일정을 삭제했습니다.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '일정 삭제에 실패했습니다.');
    }
  }

  return (
    <div>
      <h2 className="text-lg font-bold">동아리 일정 관리</h2>
      <p className="mt-1 text-sm text-fg-muted">동아리 홈페이지 달력에 표시할 학교 일정을 관리합니다.</p>

      {error && <p className="mt-3 text-sm text-[var(--color-wa)]">{error}</p>}
      {result && <p className="mt-3 text-sm text-[var(--color-ac)]">{result}</p>}

      <div className="mt-4 max-w-2xl rounded border border-ink-500 p-4">
        <h3 className="font-bold">{editingId ? '일정 수정' : '새 일정'}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-fg-muted">
            종류
            <select
              value={form.type}
              onChange={(e) => {
                const type = e.target.value as ScheduleType;
                setForm({
                  ...form,
                  type,
                  includeStart: false,
                  includeEndTime: false,
                  deadlineTime: type === 'ASSESSMENT' && !form.deadlineTime ? '23:59' : form.deadlineTime,
                });
              }}
              className="rounded border border-ink-500 bg-white px-3 py-2 text-sm text-fg"
            >
              <option value="ASSESSMENT">수행평가</option>
              <option value="EXAM">시험</option>
              <option value="EVENT">행사 및 축제</option>
              <option value="OTHER">기타</option>
            </select>
          </label>
          <fieldset className="flex flex-col gap-1 text-xs text-fg-muted">
            <legend>반 태그</legend>
            <div className="flex h-full items-center gap-4 rounded border border-ink-500 px-3 py-2 text-sm text-fg">
              {['1반', '2반', '3반'].map((classTag) => (
                <label key={classTag} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.classTags.includes(classTag)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        classTags: e.target.checked
                          ? [...form.classTags, classTag]
                          : form.classTags.filter((tag) => tag !== classTag),
                      })
                    }
                  />
                  {classTag}
                </label>
              ))}
            </div>
          </fieldset>
          {!isFlexibleType(form.type) && (
            <label className="flex flex-col gap-1 text-xs text-fg-muted">
              과목
              <input
                value={form.subject}
                maxLength={80}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="예: 정보, 수학"
                className="rounded border border-ink-500 px-3 py-2 text-sm text-fg"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs text-fg-muted sm:col-span-2">
            제목
            <input
              value={form.title}
              maxLength={120}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="예: 알고리즘 수행평가"
              className="rounded border border-ink-500 px-3 py-2 text-sm text-fg"
            />
          </label>
          {isFlexibleType(form.type) && (
            <fieldset className="flex flex-col gap-1 text-xs text-fg-muted sm:col-span-2">
              <legend>날짜 옵션</legend>
              <div className="flex gap-5 rounded border border-ink-500 px-3 py-2 text-sm text-fg">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.includeStart}
                    onChange={(e) => setForm({ ...form, includeStart: e.target.checked })}
                  />
                  시작일 포함
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={form.includeEndTime}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        includeEndTime: e.target.checked,
                        deadlineTime: e.target.checked && !form.deadlineTime ? '23:59' : form.deadlineTime,
                      })
                    }
                  />
                  종료 시간 포함
                </label>
              </div>
            </fieldset>
          )}
          {!(isFlexibleType(form.type) && !form.includeStart) && (
            <label className="flex flex-col gap-1 text-xs text-fg-muted">
              {form.type === 'ASSESSMENT' ? '날짜' : '시작일'}
              <input
                type="date"
                value={form.startsOn}
                onChange={(e) => setForm({ ...form, startsOn: e.target.value })}
                className="rounded border border-ink-500 px-3 py-2 text-sm text-fg"
              />
            </label>
          )}
          {form.type === 'ASSESSMENT' ? (
            <label className="flex flex-col gap-1 text-xs text-fg-muted">
              마감 시간
              <input
                type="time"
                value={form.deadlineTime}
                onChange={(e) => setForm({ ...form, deadlineTime: e.target.value })}
                className="rounded border border-ink-500 px-3 py-2 text-sm text-fg"
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-xs text-fg-muted">
              {isFlexibleType(form.type) && !form.includeStart ? '날짜' : '종료일'}
              <input
                type="date"
                value={form.endsOn}
                onChange={(e) => setForm({ ...form, endsOn: e.target.value })}
                className="rounded border border-ink-500 px-3 py-2 text-sm text-fg"
              />
            </label>
          )}
          {isFlexibleType(form.type) && form.includeEndTime && (
            <label className="flex flex-col gap-1 text-xs text-fg-muted">
              종료 시간
              <input
                type="time"
                value={form.deadlineTime}
                onChange={(e) => setForm({ ...form, deadlineTime: e.target.value })}
                className="rounded border border-ink-500 px-3 py-2 text-sm text-fg"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs text-fg-muted sm:col-span-2">
            범위
            <textarea
              value={form.examScope}
              maxLength={5000}
              rows={3}
              onChange={(e) => setForm({ ...form, examScope: e.target.value })}
              placeholder="시험이 아니거나 범위가 미정이면 비워둘 수 있습니다."
              className="resize-y rounded border border-ink-500 px-3 py-2 text-sm text-fg"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-fg-muted sm:col-span-2">
            설명
            <textarea
              value={form.description}
              maxLength={5000}
              rows={3}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="준비물이나 안내 사항"
              className="resize-y rounded border border-ink-500 px-3 py-2 text-sm text-fg"
            />
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? '저장 중...' : editingId ? '수정 저장' : '일정 등록'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded border border-ink-500 px-4 py-2 text-sm">
              취소
            </button>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="font-bold">등록된 일정</h3>
        {loading && <p className="mt-3 text-sm text-fg-muted">불러오는 중...</p>}
        {!loading && schedules.length === 0 && <p className="mt-3 text-sm text-fg-muted">등록된 일정이 없습니다.</p>}
        {schedules.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-ink-700 text-xs text-fg-muted">
                <tr>
                  <th className="border border-ink-600 px-3 py-2">상태</th>
                  <th className="border border-ink-600 px-3 py-2">종류</th>
                  <th className="border border-ink-600 px-3 py-2">과목 / 제목</th>
                  <th className="border border-ink-600 px-3 py-2">기간</th>
                  <th className="border border-ink-600 px-3 py-2">범위</th>
                  <th className="border border-ink-600 px-3 py-2">관리</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td className="border border-ink-600 px-3 py-2">
                      {schedule.status === 'PENDING'
                        ? '승인 대기'
                        : schedule.status === 'APPROVED'
                          ? '승인됨'
                          : '반려됨'}
                      {schedule.proposedBy && (
                        <span className="mt-1 block text-xs text-fg-muted">제안: {schedule.proposedBy}</span>
                      )}
                    </td>
                    <td className="border border-ink-600 px-3 py-2">
                      {scheduleTypeLabel(schedule.type)}
                    </td>
                    <td className="border border-ink-600 px-3 py-2">
                      <strong>{schedule.title}</strong>
                      {!isFlexibleType(schedule.type) && schedule.subject && (
                        <span className="ml-2 text-xs text-fg-muted">{schedule.subject}</span>
                      )}
                      {schedule.classTags.length > 0 && (
                        <span className="ml-2 text-xs text-[var(--color-brand)]">{schedule.classTags.join(' · ')}</span>
                      )}
                    </td>
                    <td className="border border-ink-600 px-3 py-2 tabular-nums">
                      {formatScheduleDate(schedule)}
                    </td>
                    <td className="max-w-xs whitespace-pre-wrap border border-ink-600 px-3 py-2 text-xs text-fg-muted">
                      {schedule.examScope || '-'}
                    </td>
                    <td className="border border-ink-600 px-3 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => edit(schedule)} className="text-[var(--color-brand)] hover:underline">
                          수정
                        </button>
                        <button onClick={() => remove(schedule)} className="text-[var(--color-wa)] hover:underline">
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
