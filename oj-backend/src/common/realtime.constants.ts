/**
 * 실시간 채점 결과 방송용 Redis pub/sub 채널.
 *
 * 예전에는 judge.processor.ts가 이 상수를 export하고 gateway가 거기서 import했는데,
 * 채점기가 별도 VM으로 분리되면서 그 파일이 API 서버 빌드에서 사라지므로 공용 위치로 옮겼다.
 * 이제 이 채널에 발행하는 주체는 API 서버 하나뿐이다(채점 VM에는 Redis 자격증명이 없다).
 */
export const SUBMISSION_UPDATES_CHANNEL = 'submission-updates';
