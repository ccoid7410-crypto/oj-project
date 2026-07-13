import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // API와 마찬가지로 같은 origin으로 접속한다(연결 대상 URL을 생략하면 socket.io-client가
    // 현재 페이지 origin을 쓴다). nginx가 /socket.io/를 백엔드로 업그레이드 프록시한다.
    // 개발 서버(vite dev, 5173)에서는 vite.config.ts의 프록시 설정이 같은 역할을 한다.
    //
    // 인증 핸드셰이크: 연결/재연결 시마다 auth 콜백이 호출되므로 항상 최신 토큰을 실어 보낸다.
    // 서버는 이 토큰을 검증하지 못하면 연결을 끊는다(남의 채점 결과 실시간 훔쳐보기 차단).
    socket = io({
      path: '/socket.io',
      transports: ['websocket'],
      auth: (cb) => cb({ token: localStorage.getItem('oj_token') ?? '' }),
    });
  }
  return socket;
}

/** 로그인/로그아웃 등으로 토큰이 바뀌면 소켓을 새 토큰으로 다시 연결한다. */
export function resetSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** submissionId room에 join하고, 업데이트 수신 시 콜백 실행. cleanup 함수 반환 */
export function subscribeToSubmission(
  submissionId: string,
  onUpdate: (payload: { submissionId: string; status: string }) => void,
) {
  const s = getSocket();
  s.emit('join', submissionId);

  const handler = (payload: { submissionId: string; status: string }) => {
    if (payload.submissionId === submissionId) onUpdate(payload);
  };
  s.on('submission-update', handler);

  return () => {
    s.off('submission-update', handler);
    // 소켓 하나를 앱 전체에서 계속 재사용하기 때문에(getSocket), leave를 안 하면 사용자가
    // 페이지를 옮겨다닐 때마다 예전 room에 계속 남아있게 되고, 세션이 길어질수록(=서버를
    // 오래 켜둘수록) 서버 메모리에 방(room) 멤버십이 계속 쌓인다.
    s.emit('leave', submissionId);
  };
}
