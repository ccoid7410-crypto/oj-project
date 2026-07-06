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
- `frontend` — Vite 빌드 결과를 nginx로 서빙 (SPA 라우팅 처리 포함). `/home/`은 homepage 컨테이너로, `/api/`는 api 컨테이너로 프록시한다.
- `homepage` — 동아리 홈페이지(`club-homepage/`, 정적 HTML/CSS/JS)를 nginx로 서빙. 외부 포트는 열지 않고 frontend를 통해서만 접근한다. OJ와 같은 origin을 유지해 localStorage의 `oj_token`을 공유하므로 두 페이지 간 로그인 상태가 이어진다.

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

## 저사양 호스트(라즈베리파이 4B 8GB 등) 튜닝

`docker-compose.yml`이 8GB 기준으로 이미 튜닝되어 있다:

- `postgres`/`redis`를 alpine 이미지로 교체(용량/메모리 footprint 축소), `shared_buffers`/`work_mem`/`max_connections`을 낮게 잡음.
- 모든 서비스에 `deploy.resources.limits.memory`/`cpus`를 설정해서 한 서비스가 메모리를 독차지해 다른 서비스가 OOM-kill 당하는 걸 막음 (postgres 384M, api 384M, judge-worker 256M, redis 128M, frontend 64M, homepage 32M — 합쳐서 약 1.6GB, 나머지는 채점용 임시 컨테이너와 OS 몫).
- `api`/`judge-worker`에 `NODE_OPTIONS=--max-old-space-size`를 컨테이너 메모리 상한보다 살짝 낮게 설정해서, cgroup에 급사당하기 전에 V8이 스스로 GC를 더 자주 돌리게 함.
- **redis의 `maxmemory-policy`는 반드시 `noeviction`이어야 한다.** `allkeys-lru` 등으로 두면 BullMQ 큐 데이터가 메모리 부족 시 조용히 삭제되어(evict) 채점 대기 중이던 제출이 그냥 사라질 수 있다. `noeviction`이면 메모리가 꽉 찼을 때 에러를 내므로 최소한 알아챌 수 있다.
- `JUDGE_CONCURRENCY`(루트 `.env`, 기본 2): 동시 채점 개수. 컴파일 단계(특히 Java/C++)가 한 번에 최대 512MB까지 쓸 수 있어서, 2로 두면 최악의 경우 순간적으로 ~1GB까지 튈 수 있다. 채점이 자주 밀리거나 메모리가 빠듯하면 1로 낮출 것.
- 그래도 여유가 없다면 호스트 OS에 swap(zram 권장)을 추가로 잡아두는 걸 권장한다 — 위 설정들은 정상 동작 시의 메모리 사용량을 낮추는 것이지, 순간적인 스파이크(동시 접속/제출 몰림)까지 완전히 막아주진 않는다.
