# OJ Frontend (React + Vite + Tailwind v4)

`oj-backend`를 호출하는 온라인 저지 웹 클라이언트입니다.

## 실행

```bash
npm install
npm run dev
```

`.env`의 `VITE_API_URL`이 백엔드 API 서버 주소를 가리키는지 확인하세요 (기본값 `http://localhost:3000`).

## 화면 구성

- `/` — 랜딩
- `/login`, `/signup` — 인증
- `/problems` — 문제 목록
- `/problems/:slug` — 문제 상세 + 코드 에디터(언어 선택, textarea) + 제출
- `/submissions/:id` — 제출 결과. WebSocket으로 실시간 갱신되며, 테스트케이스가 하나씩 채점되는 로그 형태로 표시
- `/submissions` — 내 제출 목록 (로그인 필요)

## 디자인 톤

터미널/컴파일러 로그 느낌의 다크 테마. 각 채점 상태(AC/WA/TLE/CE 등)를 색으로 구분하고,
제출 결과 페이지에서 테스트케이스가 순서대로 판정되는 걸 로그처럼 보여주는 게 이 UI의 핵심 포인트예요.

## 알아둘 점 / 다음 단계

- 코드 에디터는 지금 plain `<textarea>`입니다. 문법 하이라이팅이 필요하면 Monaco Editor(`@monaco-editor/react`)로 교체하는 걸 추천해요.
- 백엔드가 CORS를 `origin: '*'`로 열어뒀는데, 운영 배포 시엔 실제 프론트 도메인으로 좁혀야 합니다 (`oj-backend/src/main.ts`).
- 문제 등록/공개용 관리자 화면은 아직 없어서, 지금은 API를 직접 호출(Postman 등)해서 문제를 등록해야 문제 목록에 뜹니다.
