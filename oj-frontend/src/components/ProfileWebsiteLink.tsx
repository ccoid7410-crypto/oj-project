import type { ReactNode } from 'react';

type WebsiteKind = 'instagram' | 'github' | 'website';

interface WebsiteDetails {
  kind: WebsiteKind;
  label: string;
  service: string;
}

function readablePath(url: URL, firstSegmentOnly = false): string | null {
  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  if (segments.length === 0) return null;
  return firstSegmentOnly ? segments[0].replace(/^@/, '') : segments.join('/');
}

function describeWebsite(site: string): WebsiteDetails {
  try {
    const url = new URL(site);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');

    if (hostname === 'instagram.com') {
      return {
        kind: 'instagram',
        label: readablePath(url, true) ?? 'Instagram',
        service: 'Instagram',
      };
    }
    if (hostname === 'github.com') {
      return {
        kind: 'github',
        label: readablePath(url) ?? 'GitHub',
        service: 'GitHub',
      };
    }
    return { kind: 'website', label: hostname, service: hostname };
  } catch {
    return { kind: 'website', label: site, service: '웹사이트' };
  }
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" className="fill-current stroke-none" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49l-.01-1.92c-2.78.62-3.37-1.21-3.37-1.21-.46-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .08 1.53 1.06 1.53 1.06.9 1.56 2.35 1.11 2.92.85.09-.66.35-1.11.64-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.4 9.4 0 0 1 12 6.92a9.4 9.4 0 0 1 2.5.35c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.35 4.8-4.58 5.05.36.32.68.94.68 1.89l-.01 2.82c0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function WebsiteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9h17M3.5 15h17M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21c-2.2-2.5-3.3-5.5-3.3-9S9.8 5.5 12 3Z" />
    </svg>
  );
}

const ICONS: Record<WebsiteKind, ReactNode> = {
  instagram: <InstagramIcon />,
  github: <GitHubIcon />,
  website: <WebsiteIcon />,
};

const ICON_COLORS: Record<WebsiteKind, string> = {
  instagram: 'text-[#e4405f]',
  github: 'text-fg',
  website: 'text-[var(--color-brand)]',
};

export function ProfileWebsiteLink({ site }: { site: string }) {
  const details = describeWebsite(site);
  return (
    <a
      href={site}
      target="_blank"
      rel="noopener noreferrer"
      title={site}
      aria-label={`${details.service}: ${details.label}`}
      className="group inline-flex min-w-0 max-w-full items-center gap-2 rounded-md border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-fg shadow-sm transition hover:-translate-y-px hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] hover:shadow"
    >
      <span className={`shrink-0 ${ICON_COLORS[details.kind]}`}>{ICONS[details.kind]}</span>
      <span className="truncate">{details.label}</span>
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-3 w-3 shrink-0 text-fg-muted transition group-hover:text-[var(--color-brand)]"
      >
        <path d="M6 3h7v7h-1.5V5.56l-6.97 6.97-1.06-1.06 6.97-6.97H6V3Z" fill="currentColor" />
      </svg>
    </a>
  );
}
