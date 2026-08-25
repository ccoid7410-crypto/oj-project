import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// club-homepage/js/exam-scope.js의 React 버전. 조회(GET /api/exam-scopes)는
// 백엔드 가드가 없어 완전 공개이고, 편집(추가/이름/범위/순서)만 지정 관리자(hift)
// 계정에서 UI가 노출된다(서버는 MEMBER/DEV/ADMIN 역할이면 다 받아주지만, 이건
// 이 마이그레이션 이전부터 있던 차이라 그대로 둔다 - 계획 문서 Phase 5 참고).

const ACADEMIC_YEAR = 2026;
const SEMESTER = 2;
type ExamType = 'MIDTERM' | 'FINAL';
const EXAM_LABELS: Record<ExamType, string> = { MIDTERM: '중간고사', FINAL: '기말고사' };

interface ExamScope {
  id: string;
  examType: ExamType;
  subject: string;
  scope: string;
  displayOrder: number;
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function ExamScopePage() {
  const { user } = useAuth();
  const canEdit = user?.username === 'hift';

  const [selectedExamType, setSelectedExamType] = useState<ExamType>('MIDTERM');
  const [scopes, setScopes] = useState<ExamScope[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const loadExamScopes = useCallback(async () => {
    setError(null);
    try {
      const query = new URLSearchParams({
        academicYear: String(ACADEMIC_YEAR),
        semester: String(SEMESTER),
        examType: selectedExamType,
      });
      setScopes(await api.get<ExamScope[]>(`/exam-scopes?${query}`));
    } catch {
      setScopes(null);
      setError('시험범위를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  }, [selectedExamType]);

  useEffect(() => {
    void loadExamScopes();
  }, [loadExamScopes]);

  async function onRenameSubject(item: ExamScope) {
    const next = window.prompt('과목 이름', item.subject);
    if (next === null) return;
    const subject = next.trim();
    if (!subject || subject === item.subject) return;
    try {
      await api.patch(`/exam-scopes/${encodeURIComponent(item.id)}`, { subject });
      void loadExamScopes();
    } catch (err) {
      window.alert(errorMessage(err, '저장하지 못했습니다.'));
    }
  }

  /** 목록에서 위/아래로 한 칸 옮긴다(옆 과목과 displayOrder를 맞바꾼다). */
  async function onMoveSubject(item: ExamScope, delta: -1 | 1) {
    if (!scopes) return;
    const index = scopes.indexOf(item);
    const other = scopes[index + delta];
    if (!other) return;
    try {
      // 순서 값이 같으면(초기 데이터) 인덱스 기준으로 다시 매겨야 자리가 바뀐다.
      const a = item.displayOrder === other.displayOrder ? index : item.displayOrder;
      const b = item.displayOrder === other.displayOrder ? index + delta : other.displayOrder;
      await api.patch(`/exam-scopes/${encodeURIComponent(item.id)}`, { displayOrder: b });
      await api.patch(`/exam-scopes/${encodeURIComponent(other.id)}`, { displayOrder: a });
      void loadExamScopes();
    } catch (err) {
      window.alert(errorMessage(err, '순서를 바꾸지 못했습니다.'));
    }
  }

  async function onAddSubject() {
    const name = window.prompt('추가할 과목 이름');
    if (name === null) return;
    const subject = name.trim();
    if (!subject) return;
    try {
      await api.post('/exam-scopes', {
        academicYear: ACADEMIC_YEAR,
        semester: SEMESTER,
        examType: selectedExamType,
        subject,
      });
      void loadExamScopes();
    } catch (err) {
      window.alert(errorMessage(err, '과목을 추가하지 못했습니다.'));
    }
  }

  function beginEditScope(item: ExamScope) {
    setEditingId(item.id);
    setEditValue(item.scope);
  }

  async function onSaveScope(item: ExamScope) {
    setSaving(true);
    try {
      await api.put(`/exam-scopes/${encodeURIComponent(item.id)}`, { scope: editValue });
      setEditingId(null);
      void loadExamScopes();
    } catch {
      window.alert('시험범위를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-fg">시험범위</h2>
          <p className="mt-1 text-sm text-fg-muted">
            {ACADEMIC_YEAR}학년도 {SEMESTER}학기 중간·기말고사 과목별 범위를 확인하세요.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-2" role="group" aria-label="시험 구분">
          {(Object.keys(EXAM_LABELS) as ExamType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={`rounded px-3 py-1.5 text-sm font-bold ${
                selectedExamType === type
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'border border-ink-500 text-fg hover:border-[var(--color-brand)]'
              }`}
              onClick={() => setSelectedExamType(type)}
            >
              {EXAM_LABELS[type]}
            </button>
          ))}
        </div>
        {canEdit && (
          <button type="button" className="rounded border border-ink-500 px-3 py-1.5 text-sm font-bold hover:border-[var(--color-brand)]" onClick={() => void onAddSubject()}>
            과목 추가
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-fg-muted" aria-live="polite">
        {scopes && `${ACADEMIC_YEAR}학년도 ${SEMESTER}학기 · ${EXAM_LABELS[selectedExamType]} · ${scopes.length}과목`}
      </p>

      <div className="mt-2" aria-live="polite">
        {error ? (
          <p className="text-sm text-[var(--color-wa)]">{error}</p>
        ) : scopes === null ? (
          <p className="text-sm text-fg-muted">시험범위를 불러오는 중...</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {scopes.map((item, index) => (
              <article key={item.id} className="rounded border border-ink-600 bg-[var(--color-surface)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-ink-600 px-2 py-0.5 text-[11px] font-bold text-fg-muted">
                    {EXAM_LABELS[item.examType]}
                  </span>
                  {canEdit && (
                    <div className="flex items-center gap-1 text-xs">
                      <button
                        type="button"
                        title="위로"
                        disabled={index === 0}
                        className="disabled:opacity-30"
                        onClick={() => void onMoveSubject(item, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        title="아래로"
                        disabled={index === scopes.length - 1}
                        className="disabled:opacity-30"
                        onClick={() => void onMoveSubject(item, 1)}
                      >
                        ↓
                      </button>
                      <button type="button" className="text-fg-muted hover:text-[var(--color-brand)]" onClick={() => void onRenameSubject(item)}>
                        이름
                      </button>
                      <button
                        type="button"
                        className="text-fg-muted hover:text-[var(--color-brand)]"
                        onClick={() => beginEditScope(item)}
                      >
                        범위 수정
                      </button>
                    </div>
                  )}
                </div>
                <h3 className="mt-2 text-sm font-bold text-fg">{item.subject}</h3>
                {editingId === item.id ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      className="w-full rounded border border-ink-500 bg-[var(--color-surface)] p-2 text-sm"
                      maxLength={5000}
                      rows={4}
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        className="rounded bg-[var(--color-brand)] px-3 py-1 text-xs font-bold text-white"
                        onClick={() => void onSaveScope(item)}
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        className="rounded border border-ink-500 px-3 py-1 text-xs"
                        onClick={() => setEditingId(null)}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={`mt-2 text-sm ${item.scope ? 'text-fg' : 'text-fg-muted'}`}>
                    {item.scope || '아직 안 나왔습니다~'}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
