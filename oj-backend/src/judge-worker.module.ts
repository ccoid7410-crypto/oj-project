import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JudgeModule } from './judge/judge.module';

/**
 * 채점 워커 전용 부트스트랩 모듈. **이 파일이 곧 격리 경계다.**
 *
 * 여기에 PrismaModule이나 BullModule을 다시 넣는 순간 채점 VM이 DB/Redis 자격증명을
 * 갖게 되고, 이 리팩터링의 목적이 통째로 사라진다. 채점기는 docker.sock(= 호스트 root)을
 * 쥐고 남의 코드를 실행하는 가장 위험한 컴포넌트이므로, 여기서 밖으로 나갈 수 있는 경로는
 * 인터체인저로 향하는 아웃바운드 HTTP 하나뿐이어야 한다.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), JudgeModule],
})
export class JudgeWorkerModule {}
