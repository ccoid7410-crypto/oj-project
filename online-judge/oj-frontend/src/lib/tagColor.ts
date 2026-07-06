// BOJ의 "정보" 태그(다국어/스페셜저지/알고리즘 분류 등)는 태그마다 고유한 색이 붙어 알록달록하다.
// 우리는 자유 태그를 쓰므로, 태그 문자열을 해시해 고정된 팔레트에서 색을 골라 같은 느낌을 낸다.
const PALETTE = [
  { bg: '#eef0f2', fg: '#4b5157' }, // 다국어(gray)
  { bg: '#e3f6fb', fg: '#0f7ea3' }, // 스페셜저지(cyan)
  { bg: '#f1ecfc', fg: '#7b3fe4' }, // 다이나믹 프로그래밍(purple)
  { bg: '#e6f7ec', fg: '#1a9c4b' }, // 출력(green)
  { bg: '#e8f0fe', fg: '#2f6fed' }, // 구현(blue)
  { bg: '#fdf0e3', fg: '#c97a1a' }, // 그래프(orange)
  { bg: '#fdeaf0', fg: '#d63b76' }, // 문자열(pink)
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function tagColor(tag: string): { bg: string; fg: string } {
  return PALETTE[hash(tag) % PALETTE.length];
}
