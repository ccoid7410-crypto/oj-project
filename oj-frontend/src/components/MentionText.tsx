import { useEffect, useRef } from 'react';
import type { MentionUser } from '../api/types';
import { avatarUrl } from '../lib/avatar';

export type { MentionUser };

/**
 * 렌더된 본문에서 @사용자명을 찾아 프로필 칩(아바타 + 아이디)으로 바꾼다.
 * mentions에 없는 이름은 멘션이 아닐 수 있으므로 원문 그대로 둔다.
 * 마크다운 렌더 결과(HTML)를 나중에 손보는 방식이라 홈페이지와 동작이 같다.
 */
/**
 * 이미 그려진 DOM에서 @사용자명을 찾아 프로필 칩으로 바꾼다.
 * React 밖(공용 편집기 미리보기)에서도 쓰려고 평범한 함수로 뺐다.
 */
export function applyMentionChips(root: HTMLElement, mentions: MentionUser[] | undefined) {
  if (!mentions || mentions.length === 0) return;
  const known = new Map(mentions.map((m) => [m.username, m.avatarVersion]));

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const tag = node.parentElement?.tagName;
      // 코드/링크 안의 @는 건드리지 않는다(이미 칩이 된 @도 <a>라 여기서 걸러진다).
      if (tag === 'CODE' || tag === 'PRE' || tag === 'A') return NodeFilter.FILTER_REJECT;
      return /@[A-Za-z0-9_-]{2,30}/.test(node.nodeValue ?? '')
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  const targets: Text[] = [];
  while (walker.nextNode()) targets.push(walker.currentNode as Text);

  for (const node of targets) {
    const text = node.nodeValue ?? '';
    const frag = document.createDocumentFragment();
    const re = /@([A-Za-z0-9_-]{2,30})/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const username = m[1];
      if (!known.has(username)) continue;
      frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      frag.appendChild(buildChip(username, known.get(username) ?? null));
      last = m.index + m[0].length;
    }
    if (last === 0) continue;
    frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode?.replaceChild(frag, node);
  }
}

export function useMentionChips(
  ref: React.RefObject<HTMLElement | null>,
  mentions: MentionUser[] | undefined,
  deps: unknown[] = [],
) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !mentions || mentions.length === 0) return;

    const paint = () => applyMentionChips(root, mentions);

    // 본문(MarkdownView)은 lazy + Suspense라 이 훅이 처음 돌 때는 아직 비어 있을 수 있다.
    // 그래서 한 번 칠하고 끝내지 않고, 내용이 붙을 때마다 다시 칠한다.
    const options = { childList: true, subtree: true, characterData: true };
    const observer = new MutationObserver(() => {
      // 칩을 넣는 것도 변경이라 그대로 두면 무한 반복이 된다. 칠하는 동안만 감시를 끈다.
      observer.disconnect();
      paint();
      observer.observe(root, options);
    });
    paint();
    observer.observe(root, options);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, mentions, ...deps]);
}

/** 게시글 작성자 표시와 같은 규격의 인라인 칩. 누르면 사용자 페이지로 간다. */
function buildChip(username: string, avatarVersion: number | null) {
  const a = document.createElement('a');
  a.href = `/users/${encodeURIComponent(username)}`;
  a.className = 'oj-mention';

  const avatar = document.createElement('span');
  avatar.className = 'oj-mention-avatar';
  const url = avatarUrl(username, avatarVersion);
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    avatar.appendChild(img);
  }
  a.append(avatar, document.createTextNode(username));
  return a;
}

/**
 * 마크다운 렌더 결과에 멘션 칩을 입혀 보여주는 래퍼.
 * 본문이 바뀌면 다시 칠해야 하므로 바뀌는 값을 deps로 넘긴다.
 */
export function MentionScope({
  mentions,
  deps = [],
  children,
}: {
  mentions: MentionUser[] | undefined;
  deps?: unknown[];
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useMentionChips(ref, mentions, deps);
  return <div ref={ref}>{children}</div>;
}
