import { Module } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ClassesController, AdminClassesController } from './classes.controller';

@Module({
  controllers: [ClassesController, AdminClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
