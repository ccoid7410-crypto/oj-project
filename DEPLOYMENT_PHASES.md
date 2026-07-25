# 채점기·인터체인저 전환 상태

## 5단계 — 채점기를 VM2로 분리

현재 완료된 범위는 **동일 호스트 안의 Docker 네트워크 분리**다.

- `api`, PostgreSQL, Redis는 `backend_net`에 있다.
- `judge-worker`는 `judge_net`에만 있고 DB/Redis/JWT 자격증명을 받지 않는다.
- `interchanger`만 두 네트워크에 연결되어 채점 리스와 결과를 중계한다.
- 그러나 `judge-worker`는 여전히 같은 호스트의 `/var/run/docker.sock`을 마운트한다. 따라서
  `judge_net` 분리는 VM 수준의 호스트 격리가 아니며, 워커 침해 시 현재 호스트 전체가 영향을 받을 수 있다.

별도 VM2는 아직 준비되지 않았으므로 `docker-compose.judge.yml`과 `setup-judge.sh`는 지금 만들지 않는다.
실제 VM의 주소, 방화벽, Docker 데이터 경로와 토큰 전달 방식이 정해지면 다음 조건으로 만든다.

1. VM2에는 `judge-worker`와 채점용 언어 이미지만 배포한다.
2. DB·Redis·JWT·SMTP 자격증명은 VM2에 전달하지 않는다.
3. VM2는 인터체인저 내부 리스너 `:4001`에만 접근한다.
4. `JUDGE_SERVICE_TOKEN`을 별도 비밀 전달 경로로 설치하고 회전 절차를 확인한다.
5. VM2의 Docker 소켓 권한은 VM2 안으로만 영향이 제한되는지 검증한다.

## 6단계 — 프론트를 인터체인저 공개 프록시로 전환

인터체인저의 공개 리스너(`:4000`)와 다음 방어는 구현돼 있다.

- 요청을 API로 스트리밍 전달
- `/internal` 및 하위 경로 404 차단
- 내부 서비스 헤더 제거
- 요청 크기 제한
- Socket.IO Upgrade 전달

하지만 **현재 프론트 nginx는 아직 `api:3000`으로 직접 프록시한다.** 즉 공개 프록시는 준비·개별
스모크 테스트 단계이며 실제 트래픽 경로에는 들어가 있지 않다. 보안 이득은 내부 리스너의 물리적
포트 분리보다 작고, `/socket.io`가 nginx → interchanger → API의 이중 WebSocket 프록시가 되어
실패 시 실시간 채점 갱신이 폴백 없이 끊길 수 있으므로 마지막 단계로 유지한다.

전환은 아래 조건을 모두 만족할 때 `/api`, `/socket.io`, `/uploads`를 한 번에 바꾼다.

1. REST API와 대용량 테스트케이스/배너 업로드가 인터체인저 경유로 성공한다.
2. 외부에서 `/internal/*`가 계속 404이고 내부 헤더가 제거된다.
3. 실제 브라우저에서 Socket.IO 연결·재연결·제출 room 구독·최종 판정 갱신이 성공한다.
4. API의 `TRUST_PROXY_HOPS`를 현재 1에서 2로 바꾸고 rate limit이 실제 클라이언트 IP별로
   유지되는지 확인한다. 롤백 시 이 값도 1로 되돌린다.
5. 컨테이너 재생성 및 nginx/interchanger/API 각각의 재시작 뒤에도 WebSocket이 복구된다.
6. 실패 시 nginx upstream을 `api:3000`으로 즉시 되돌리는 롤백 절차를 준비한다.
