# 프로젝트 인수인계 — Durunuri OJ (온라인 저지)

## 새 리눅스 머신에서 세팅하기 (amd64/arm64 모두 지원)

이 저장소를 그대로 복사해온 새 머신(x86 서버든 ARM 서버/VM이든 무관)에서:

```bash
git clone <repo>   # 또는 저장소를 그대로 복사
cd oj-project
./setup.sh         # .env 파일 생성 + HOST_JUDGE_TMP_DIR/JWT_SECRET 자동 채움
docker compose build
docker compose up -d
```

- `api` 컨테이너는 기동 시 자동으로 `prisma migrate deploy`를 실행하므로 DB가 완전히 비어 있어도 알아서 스키마를 만든다.
- 모든 Dockerfile은 `FROM`에 `--platform`을 고정하지 않는다. 사용하는 베이스 이미지(node, postgres, redis, gcc, python, eclipse-temurin, golang, nginx)가 전부 amd64/arm64 공식 멀티아키텍처 이미지라서, 빌드/실행하는 호스트 아키텍처에 맞는 이미지가 자동으로 선택된다. 에뮬레이션 없이 ARM 서버에서도 네이티브로 동작한다.
- `setup.sh`가 채워주지 못하는 값(도메인, 이메일 발송 도메인, SMTP 등)은 `oj-backend/.env`를 직접 열어 확인해야 한다 — 아래 "배포 전 확인할 값" 참고.
- 배포 도메인이 `localhost`가 아니라면 루트 `.env`의 `VITE_API_URL`을 실제 API 도메인으로 바꾸고 프론트 이미지를 다시 빌드해야 한다(`docker compose build frontend`). Vite는 이 값을 빌드 시점에 정적 파일에 박아 넣기 때문에 컨테이너 실행 중에는 바꿀 수 없다.

### 배포 전 확인할 값 (`oj-backend/.env`)

- `JWT_SECRET` — setup.sh가 무작위 생성. 절대 예시값을 그대로 쓰지 말 것.
- `CORS_ORIGIN`, `FRONTEND_URL` — 실제 프론트엔드 도메인으로.
- `SIGNUP_EMAIL_DOMAIN` — 회원가입을 받을 이메일 도메인(현재 `cbsh.hs.kr`).
- `SMTP_*` — 비워두면 인증 메일 대신 서버 로그에 링크가 남는다(운영에서는 실제 SMTP 설정 필요).
- `HOST_JUDGE_TMP_DIR` — judge-worker가 Docker-outside-of-Docker로 형제 컨테이너를 띄울 때 쓰는 호스트 절대경로. 머신마다 다르므로 손으로 채우지 말고 반드시 `setup.sh`로 채운다. (이 값이 잘못되면 채점이 "형제 컨테이너를 못 띄우는" 방식으로 조용히 실패하니 주의.)

### 아키텍처 개요

- `postgres` / `redis` — 상태 저장소
- `api` (`dist/main.js`) — REST API + WebSocket 게이트웨이
- `judge-worker` (`dist/main-worker.js`) — BullMQ 워커. `docker.sock`을 마운트해서 언어별 컴파일/실행용 컨테이너를 직접 띄운다(Docker-outside-of-Docker). **이 소켓 마운트는 사실상 호스트 root 권한과 동급**이므로, 운영 환경에서는 이 워커를 API 서버와 분리된 전용 서버/VM에 두는 걸 권장한다.
- `frontend` — Vite 빌드 결과를 nginx로 서빙 (SPA 라우팅 처리 포함)

## 지금까지 만든 것 (요약)

- `auth` — 회원가입(이메일 도메인 제한 + 이메일 인증), 로그인, JWT (역할 재확인 포함)
- `users` — 프로필/랭킹(PII 최소화된 응답), 학번 등록 + 어드민이 지정한 수정 기간에만 수정 가능, 동아리 학번 화이트리스트
- `problems` — 문제 CRUD, 일반 사용자 제안 → 어드민 승인 후 공개, solved.ac 스타일 티어(브론즈~루비 x 5레벨), 커뮤니티 난이도 투표
- `submissions` / `judge` — BullMQ 큐 채점, 언어별(C/C++/Java/Python3/JS/Go) 샌드박스 실행, WebSocket 실시간 채점 로그
- `rating` — 상위 100문제 난이도 합산 레이팅
- `contests` — 대회 생성/문제 구성/리더보드
- `admin` — 계정 대량 생성(첫 로그인 시 비밀번호 강제 변경), 계정 정지/차단, judge-config(컴파일 플래그 등) UI 편집, 난이도 투표 급변 알림, 외부 API 키 발급
- `external` API — 외부 서비스용 최소 필드 응답 + rate limit + 사용 로그

## 아직 구현 안 한 기능 (2차 확장 후보)

- 코드 에디터를 plain textarea → Monaco Editor로 교체
- 문제 태그/검색 필터링 고도화

## 운영 시 참고

- judge 샌드박스(`docker-sandbox.service.ts`)는 non-root 유저, `ReadonlyRootfs`, `CapDrop: ALL`, `no-new-privileges`, tmpfs `/tmp`, PID 제한이 이미 적용되어 있다.
- `prisma migrate diff`로 마이그레이션 파일과 실제 스키마 간 drift가 없는지 주기적으로 확인할 것 — 수기로 DB를 고친 적이 있다면 반드시 마이그레이션 파일에도 반영해야 한다(안 그러면 새 머신에 배포할 때만 실패하는 버그가 생긴다).
