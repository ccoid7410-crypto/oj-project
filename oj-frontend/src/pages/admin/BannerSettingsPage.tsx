import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

type AdminBanner = {
  enabled: boolean;
  imageUrl: string | null;
  linkUrl: string | null;
  updatedAt: string | null;
};

export function BannerSettingsPage() {
  const { user } = useAuth();
  const canEdit = user?.username === 'jihun1050';
  const [banner, setBanner] = useState<AdminBanner | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const next = await api.get<AdminBanner>('/admin/banner');
      setBanner(next);
      setEnabled(next.enabled);
      setLinkUrl(next.linkUrl ?? '');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '배너 설정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function save() {
    if (file && file.size > 5 * 1024 * 1024) {
      setError('배너 이미지는 5MB 이하여야 합니다.');
      return;
    }
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.set('enabled', String(enabled));
      formData.set('linkUrl', linkUrl.trim());
      if (file) formData.set('image', file);
      const next = await api.upload<AdminBanner>('/admin/banner', formData);
      setBanner(next);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setResult('배너 설정을 저장했습니다.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '배너 설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm('배너 이미지를 삭제하고 끌까요?')) return;
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const next = await api.delete<AdminBanner>('/admin/banner');
      setBanner(next);
      setEnabled(next.enabled);
      setLinkUrl(next.linkUrl ?? '');
      setResult('배너를 삭제했습니다.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '배너 삭제에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !banner) return <p className="text-sm text-fg-muted">불러오는 중...</p>;

  const displayImage = previewUrl ?? banner?.imageUrl ?? null;

  return (
    <div className="max-w-2xl">
      <div>
        <h2 className="text-lg font-bold">배너 설정</h2>
        <p className="mt-1 text-sm text-fg-muted">동아리 홈페이지 상단에 노출할 배너 이미지를 관리합니다.</p>
        {!canEdit && <p className="mt-1 text-xs text-[var(--color-wa)]">배너 수정은 jihun1050 관리자만 가능합니다.</p>}
      </div>

      {error && <p className="mt-3 text-sm text-[var(--color-wa)]">{error}</p>}
      {result && <p className="mt-3 text-sm text-[var(--color-ac)]">{result}</p>}

      <div className="mt-4 rounded border border-ink-500 p-4">
        {displayImage ? (
          <img src={displayImage} alt="배너 미리보기" className="max-h-48 w-full rounded object-contain bg-ink-700" />
        ) : (
          <p className="text-sm text-fg-muted">업로드된 배너 이미지가 없습니다.</p>
        )}

        <label className="mt-4 flex flex-col gap-1 text-xs text-fg-muted">
          배너 이미지 (png/jpeg/webp/gif, 5MB 이하)
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={!canEdit}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-fg"
          />
        </label>

        <label className="mt-4 flex flex-col gap-1 text-xs text-fg-muted">
          클릭 시 이동할 링크 (선택)
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://... 또는 비워두면 클릭 불가"
            disabled={!canEdit}
            className="rounded border border-ink-500 px-3 py-2 text-sm text-fg outline-none focus:border-[var(--color-brand)]"
          />
        </label>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} disabled={!canEdit} onChange={(e) => setEnabled(e.target.checked)} />
          배너 노출 켜기
        </label>

        <div className="mt-4 flex gap-2">
          <button
            onClick={save}
            disabled={!canEdit || saving}
            className="rounded bg-[var(--color-brand)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--color-brand-dim)] disabled:opacity-60"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
          <button
            onClick={remove}
            disabled={!canEdit || saving || !banner?.imageUrl}
            className="rounded border border-ink-500 px-3 py-2 text-xs hover:border-[var(--color-wa)] hover:text-[var(--color-wa)] disabled:opacity-50"
          >
            배너 삭제
          </button>
        </div>
      </div>
    </div>
  );
}
