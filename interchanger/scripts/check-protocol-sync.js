#!/usr/bin/env node
/**
 * 인터체인저와 백엔드가 공유하는 파일이 실제로 동일한지 빌드 시점에 강제한다.
 *
 * 두 서비스는 의도적으로 별도 패키지다(인터체인저에 Prisma가 딸려오면 안 되므로).
 * 그 대가로 프로토콜 정의가 두 벌 존재하는데, 한쪽만 고치면 런타임에야 어긋남이 드러난다.
 * npm workspace를 도입하기엔 파일 두 개 때문에 과하므로, 대신 여기서 diff로 못 박는다.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PAIRS = [
  ['oj-backend/src/judge/judge-protocol.ts', 'interchanger/src/judge/judge-protocol.ts'],
  ['oj-backend/src/common/service-token.ts', 'interchanger/src/common/service-token.ts'],
];

let failed = false;
for (const [source, mirror] of PAIRS) {
  const a = path.join(ROOT, source);
  const b = path.join(ROOT, mirror);
  if (!fs.existsSync(a) || !fs.existsSync(b)) {
    console.error(`[protocol-sync] 파일을 찾을 수 없습니다: ${!fs.existsSync(a) ? source : mirror}`);
    failed = true;
    continue;
  }
  // 개행 차이(CRLF/LF)는 git autocrlf 때문에 갈릴 수 있으므로 정규화 후 비교한다.
  const normalize = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  if (normalize(a) !== normalize(b)) {
    console.error(`[protocol-sync] 내용이 다릅니다:\n  ${source}\n  ${mirror}`);
    console.error('  → 한쪽을 고쳤으면 다른 쪽에도 그대로 복사해야 합니다.');
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('[protocol-sync] 공유 파일 동기화 확인 완료');
