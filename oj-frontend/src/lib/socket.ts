import { io, type Socket } from 'socket.io-client';
import { API_URL } from '../api/client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, { transports: ['websocket'] });
  }
  return socket;
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
  };
}
