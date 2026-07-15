export function UserTitleBadge({ title }: { title?: string | null }) {
  if (!title) return null;

  return (
    <span
      className="inline-flex shrink-0 items-center rounded bg-[var(--color-brand)]/10 px-1.5 py-0.5 text-[10px] font-bold leading-none text-[var(--color-brand)]"
      title={`칭호: ${title}`}
    >
      {title}
    </span>
  );
}
