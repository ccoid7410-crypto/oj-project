import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StudentIdService } from '../student-id/student-id.service';

// LCM(6,4)=12. stride = 12/weight. 매 제출마다 자기 그룹의 pass를 stride만큼 증가시키고
// "증가 전" 값을 BullMQ 우선순위(작을수록 먼저 처리)로 쓰면, 장기적으로 두 그룹이
// stride의 역수 비율(6:4)로 번갈아 처리된다 (Stride Scheduling).
const CLUB_STRIDE = 2; // weight 6
const GENERAL_STRIDE = 3; // weight 4

@Injectable()
export class QueuePriorityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentIdService: StudentIdService,
  ) {}

  private async isClubMember(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { studentId: true } });
    if (!user?.studentId) return false;
    return this.studentIdService.isInRoster(user.studentId);
  }

  /** 이 제출이 채점 큐에서 쓸 BullMQ priority 값을 계산 + 내부 카운터를 갱신한다. */
  async nextPriority(userId: string): Promise<number> {
    const isClub = await this.isClubMember(userId);
    const stride = isClub ? CLUB_STRIDE : GENERAL_STRIDE;
    const field = isClub ? 'clubPass' : 'generalPass';

    // upsert로 초기 행을 보장한 뒤, 원자적 증가(UPDATE ... SET col = col + N)로
    // 동시 제출 간 경쟁 상태 없이 각자 다른 pass 값을 받는다.
    const updated = await this.prisma.queuePassState.upsert({
      where: { id: 1 },
      create: { id: 1, [field]: stride } as any,
      update: { [field]: { increment: stride } } as any,
    });

    const afterValue = isClub ? updated.clubPass : updated.generalPass;
    const beforeValue = afterValue - stride;
    // BullMQ priority는 1 이상이어야 하므로 +1 오프셋.
    return beforeValue + 1;
  }
}
