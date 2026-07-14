import { unzip, type Unzipped } from 'fflate';

export interface ParsedTestCase {
  name: string; // 파일 스템 (예: "1", "large_03")
  input: string;
  output: string;
  isSample: boolean;
}

export interface ParsedZip {
  cases: ParsedTestCase[];
  warnings: string[]; // 짝이 안 맞아 제외된 파일 등 안내
}

const IGNORED = (path: string) => {
  const base = path.split('/').pop() ?? path;
  // macOS zip 부산물 / 숨김파일 무시
  return path.startsWith('__MACOSX/') || base === '.DS_Store' || base.startsWith('.');
};

function splitExt(base: string): { stem: string; ext: string } {
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return { stem: base, ext: '' };
  return { stem: base.slice(0, dot), ext: base.slice(dot + 1).toLowerCase() };
}

// 사전순이면 10이 2보다 앞에 오는 함정이 있어서, 숫자가 섞인 이름은 자연 정렬(숫자 순)한다.
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function decode(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * zip 파일을 파싱해 .in / .out(또는 .ans) 쌍을 스템 기준으로 묶는다.
 * - 폴더 구조는 무시하고 파일명만 본다(같은 스템끼리 매칭).
 * - 숫자 순으로 정렬한다.
 */
export function parseTestCaseZip(file: File): Promise<ParsedZip> {
  return new Promise((resolve, reject) => {
    file
      .arrayBuffer()
      .then((buf) => {
        unzip(new Uint8Array(buf), (err, data: Unzipped) => {
          if (err) {
            reject(new Error('zip 파일을 읽을 수 없습니다.'));
            return;
          }
          resolve(groupEntries(data));
        });
      })
      .catch(() => reject(new Error('zip 파일을 읽을 수 없습니다.')));
  });
}

function groupEntries(data: Unzipped): ParsedZip {
  // 스템 → { in?, out? }
  const groups = new Map<string, { in?: Uint8Array; out?: Uint8Array }>();

  for (const path of Object.keys(data)) {
    if (path.endsWith('/')) continue; // 디렉토리 엔트리
    if (IGNORED(path)) continue;
    const base = path.split('/').pop() ?? path;
    const { stem, ext } = splitExt(base);
    if (ext !== 'in' && ext !== 'out' && ext !== 'ans') continue; // 관심 없는 확장자
    const g = groups.get(stem) ?? {};
    if (ext === 'in') g.in = data[path];
    else g.out = data[path]; // out, ans 둘 다 출력으로 취급
    groups.set(stem, g);
  }

  const cases: ParsedTestCase[] = [];
  const unpaired: string[] = [];
  for (const [stem, g] of groups) {
    if (g.in && g.out) {
      cases.push({ name: stem, input: decode(g.in), output: decode(g.out), isSample: false });
    } else {
      unpaired.push(`${stem}.${g.in ? 'in' : 'out/ans'}`);
    }
  }

  cases.sort((a, b) => naturalCompare(a.name, b.name));

  const warnings: string[] = [];
  if (cases.length === 0) {
    warnings.push('.in / .out(또는 .ans) 쌍을 찾지 못했습니다. 파일 이름이 짝지어져 있는지 확인해주세요.');
  }
  if (unpaired.length > 0) {
    warnings.push(`짝이 없어 제외된 파일: ${unpaired.slice(0, 10).join(', ')}${unpaired.length > 10 ? ' 외' : ''}`);
  }
  return { cases, warnings };
}
