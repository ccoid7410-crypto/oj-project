import type { ReactNode } from "react";

type WebsiteKind =
  | "instagram"
  | "github"
  | "solvedac"
  | "baekjoon"
  | "codeforces"
  | "youtube"
  | "x"
  | "discord"
  | "notion"
  | "website";

interface WebsiteDetails {
  kind: WebsiteKind;
  label: string;
  service: string;
}

function readablePath(url: URL, firstSegmentOnly = false): string | null {
  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  if (segments.length === 0) return null;
  return firstSegmentOnly ? segments[0].replace(/^@/, "") : segments.join("/");
}

function describeWebsite(site: string): WebsiteDetails {
  try {
    const url = new URL(site);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

    if (hostname === "instagram.com") {
      return {
        kind: "instagram",
        label: readablePath(url, true) ?? "Instagram",
        service: "Instagram",
      };
    }
    if (hostname === "github.com") {
      return {
        kind: "github",
        label: readablePath(url) ?? "GitHub",
        service: "GitHub",
      };
    }
    if (hostname === "solved.ac") {
      return {
        kind: "solvedac",
        label:
          readablePath(url, true) === "profile"
            ? (readablePathSegment(url, 1) ?? "solved.ac")
            : (readablePath(url) ?? "solved.ac"),
        service: "solved.ac",
      };
    }
    if (hostname === "acmicpc.net") {
      return {
        kind: "baekjoon",
        label:
          readablePathSegment(url, 0) === "user"
            ? (readablePathSegment(url, 1) ?? "백준")
            : (readablePath(url) ?? "백준"),
        service: "백준 온라인 저지",
      };
    }
    if (hostname === "codeforces.com") {
      return {
        kind: "codeforces",
        label:
          readablePathSegment(url, 0) === "profile"
            ? (readablePathSegment(url, 1) ?? "Codeforces")
            : (readablePath(url) ?? "Codeforces"),
        service: "Codeforces",
      };
    }
    if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "youtu.be"
    ) {
      return {
        kind: "youtube",
        label: youtubeLabel(url),
        service: "YouTube",
      };
    }
    if (hostname === "x.com" || hostname === "twitter.com") {
      return {
        kind: "x",
        label: readablePath(url, true) ?? "X",
        service: "X",
      };
    }
    if (
      hostname === "discord.gg" ||
      hostname === "discord.com" ||
      hostname === "discordapp.com"
    ) {
      return {
        kind: "discord",
        label: readablePathSegment(url, -1) ?? "Discord",
        service: "Discord",
      };
    }
    if (hostname === "notion.so" || hostname.endsWith(".notion.site")) {
      return {
        kind: "notion",
        label: notionLabel(url, hostname),
        service: "Notion",
      };
    }
    return { kind: "website", label: hostname, service: hostname };
  } catch {
    return { kind: "website", label: site, service: "웹사이트" };
  }
}

function readablePathSegment(url: URL, index: number): string | null {
  const segments = url.pathname.split("/").filter(Boolean);
  const normalizedIndex = index < 0 ? segments.length + index : index;
  const segment = segments[normalizedIndex];
  if (!segment) return null;
  try {
    return decodeURIComponent(segment).replace(/^@/, "");
  } catch {
    return segment.replace(/^@/, "");
  }
}

function youtubeLabel(url: URL): string {
  const first = readablePathSegment(url, 0);
  if (!first) return "YouTube";
  if (["channel", "c", "user"].includes(first))
    return readablePathSegment(url, 1) ?? "YouTube";
  return first;
}

function notionLabel(url: URL, hostname: string): string {
  if (hostname.endsWith(".notion.site")) {
    return hostname.slice(0, -".notion.site".length) || "Notion";
  }
  const page = readablePathSegment(url, 0);
  return page?.replace(/-[0-9a-f]{32}$/i, "") || "Notion";
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" className="fill-current stroke-none" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 fill-current"
    >
      <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49l-.01-1.92c-2.78.62-3.37-1.21-3.37-1.21-.46-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .08 1.53 1.06 1.53 1.06.9 1.56 2.35 1.11 2.92.85.09-.66.35-1.11.64-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.4 9.4 0 0 1 12 6.92a9.4 9.4 0 0 1 2.5.35c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.35 4.8-4.58 5.05.36.32.68.94.68 1.89l-.01 2.82c0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function SolvedAcIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="2.2"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m7.5 12 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BaekjoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="2"
    >
      <path d="M8 4H5v16h3M16 4h3v16h-3" strokeLinecap="round" />
      <path
        d="m10 9-3 3 3 3M14 9l3 3-3 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CodeforcesIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <rect x="3" y="9" width="5" height="11" rx="1" fill="#f44336" />
      <rect x="9.5" y="4" width="5" height="16" rx="1" fill="#2196f3" />
      <rect x="16" y="7" width="5" height="13" rx="1" fill="#ffc107" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.6 4.6 12 4.6 12 4.6s-5.6 0-7.5.5a3 3 0 0 0-2.1 2.1C2 9.1 2 12 2 12s0 2.9.4 4.8a3 3 0 0 0 2.1 2.1c1.9.5 7.5.5 7.5.5s5.6 0 7.5-.5a3 3 0 0 0 2.1-2.1c.4-1.9.4-4.8.4-4.8s0-2.9-.4-4.8Z"
        fill="#ff0033"
      />
      <path d="m10 15.5 5-3.5-5-3.5v7Z" fill="#fff" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 fill-current"
    >
      <path d="M18.9 3H22l-6.77 7.74L23.2 21h-6.24l-4.89-6.39L6.48 21H3.36l7.25-8.29L2.97 3H9.37l4.42 5.84L18.9 3Zm-1.1 16.2h1.73L8.43 4.7H6.58L17.8 19.2Z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 fill-current"
    >
      <path d="M19.5 5.3A17 17 0 0 0 15.3 4l-.5 1a15 15 0 0 0-5.6 0l-.5-1a17 17 0 0 0-4.2 1.3C1.8 9.3 1.1 13.2 1.5 17a17 17 0 0 0 5.2 2.7l1.3-1.8c-.7-.3-1.4-.7-2-1.2l.5-.4c3.8 1.8 7.9 1.8 11.6 0l.5.4c-.7.5-1.4.9-2.1 1.2l1.3 1.8A17 17 0 0 0 23 17c.5-4.4-.8-8.2-3.5-11.7ZM8.4 14.7c-1.1 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4Zm7.2 0c-1.1 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4Z" />
    </svg>
  );
}

function NotionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="1.8"
    >
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path
        d="M8 17V7l8 10V7M7 7h3M14 7h3M7 17h3M14 17h3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WebsiteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 fill-none stroke-current"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9h17M3.5 15h17M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21c-2.2-2.5-3.3-5.5-3.3-9S9.8 5.5 12 3Z" />
    </svg>
  );
}

const ICONS: Record<WebsiteKind, ReactNode> = {
  instagram: <InstagramIcon />,
  github: <GitHubIcon />,
  solvedac: <SolvedAcIcon />,
  baekjoon: <BaekjoonIcon />,
  codeforces: <CodeforcesIcon />,
  youtube: <YouTubeIcon />,
  x: <XIcon />,
  discord: <DiscordIcon />,
  notion: <NotionIcon />,
  website: <WebsiteIcon />,
};

const ICON_COLORS: Record<WebsiteKind, string> = {
  instagram: "text-[#e4405f]",
  github: "text-fg",
  solvedac: "text-[#00c48c]",
  baekjoon: "text-[#0076c0]",
  codeforces: "text-fg",
  youtube: "text-[#ff0033]",
  x: "text-fg",
  discord: "text-[#5865f2]",
  notion: "text-fg",
  website: "text-[var(--color-brand)]",
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
      <span className={`shrink-0 ${ICON_COLORS[details.kind]}`}>
        {ICONS[details.kind]}
      </span>
      <span className="truncate">{details.label}</span>
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="h-3 w-3 shrink-0 text-fg-muted transition group-hover:text-[var(--color-brand)]"
      >
        <path
          d="M6 3h7v7h-1.5V5.56l-6.97 6.97-1.06-1.06 6.97-6.97H6V3Z"
          fill="currentColor"
        />
      </svg>
    </a>
  );
}
