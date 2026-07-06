# OJ Backend (NestJS + Prisma + BullMQ + Docker Sandbox)

x86_64 서버 배포를 기준으로 만든 온라인 저지 백엔드 스캐폴드입니다.

## 아키텍처 요약

- **API 서버** (`src/main.ts`): 회원가입/로그인, 문제 CRUD, 제출 생성/조회, WebSocket으로 채점 상태 실시간 push
- **채점 워커** (`src/main-worker.ts`): Redis 큐(BullMQ)에서 제출 job을 꺼내 Docker 컨테이너에서 컴파일/실행하고 결과를 DB에 반영. **docker.sock 접근 권한이 필요하므로 API 서버와 반드시 분리 배포**할 것
- API ↔ 워커 통신: DB(Postgres) + Redis 큐 + Redis pub/sub(`submission-updates` 채널, 워커가 publish → API의 WebSocket Gateway가 구독해서 클라이언트로 relay)

## 이 샌드박스 환경에서 못한 것 (실제 서버에서 꼭 해야 함)

이 작업을 진행한 컨테이너는 `binaries.prisma.sh`, `docker.sock` 등에 접근이 막혀 있어서 아래는 실제 배포 서버에서 직접 실행해야 합니다.

1. **Prisma Client 생성**
   ```bash
   npm install
   npx prisma generate
   npx prisma migrate dev --name init   # Postgres에 테이블 생성
   ```
   (지금 상태로 `tsc`를 돌리면 PrismaService 관련 타입 에러가 나는데, 전부 `prisma generate`를 안 해서 발생하는 것이고 정상입니다.)

2. **채점용 도커 이미지 미리 pull** (첫 채점 때 pull 대기시간 방지)
   ```bash
   docker pull gcc:13-bookworm
   docker pull python:3.12-slim
   docker pull openjdk:21-slim
   docker pull node:20-slim
   docker pull golang:1.22-bookworm
   ```

3. **환경변수(.env) 값 실제 값으로 교체** — 특히 `JWT_SECRET`, DB 비밀번호

## 로컬 실행

```bash
docker compose up --build
```

- API: http://localhost:3000
- Postgres: localhost:5432
- Redis: localhost:6379

## 채점 워커 보안 관련 TODO (운영 전 필수)

`src/judge/sandbox/docker-sandbox.service.ts`에 정리해뒀지만 다시 강조하면:

- [ ] 컨테이너 실행 유저를 non-root로 고정 (현재는 이미지 기본 유저 = 대부분 root)
- [ ] seccomp 프로필 적용으로 위험한 syscall 차단
- [ ] `ReadonlyRootfs: true` + 필요한 경로만 tmpfs로 허용
- [ ] judge-worker 서버 자체를 API 서버와 네트워크 분리 (docker.sock 마운트 = 사실상 호스트 root 권한이라 탈취 시 피해 범위가 큼)
- [ ] 리소스 고갈 방지용 큐 concurrency/rate limit 튜닝 (`@Processor(JUDGE_QUEUE, { concurrency: N })`)

## 주요 API

| Method | Path | 설명 |
|---|---|---|
| POST | /auth/signup | 회원가입 |
| POST | /auth/login | 로그인, JWT 발급 |
| GET | /problems | 공개된 문제 목록 |
| GET | /problems/:slug | 문제 상세 (샘플 테스트케이스 포함) |
| POST | /problems | 문제 생성 (로그인 필요) |
| PATCH | /problems/:id/publish | 문제 공개 (ADMIN) |
| POST | /submissions | 제출 (로그인 필요) → 채점 큐 등록 |
| GET | /submissions/:id | 제출 결과 조회 |
| GET | /submissions/me | 내 제출 목록 |
| WS | (root) | `join` 이벤트로 submissionId room 참가 → `submission-update` 수신 |

## 아직 안 만든 것 (2차 확장 후보)

- Contest(대회) 모듈, 리더보드
- 문제 태그/난이도 필터링, 검색
- 관리자 대시보드용 API
- Rate limiting (제출 스팸 방지)
