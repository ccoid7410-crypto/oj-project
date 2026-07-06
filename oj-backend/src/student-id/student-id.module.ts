import { Module } from '@nestjs/common';
import { StudentIdService } from './student-id.service';

@Module({
  providers: [StudentIdService],
  exports: [StudentIdService],
})
export class StudentIdModule {}
