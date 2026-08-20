import { Module } from '@nestjs/common';
import { PatchNotesController } from './patch-notes.controller';
import { PatchNotesService } from './patch-notes.service';

@Module({
  controllers: [PatchNotesController],
  providers: [PatchNotesService],
  exports: [PatchNotesService],
})
export class PatchNotesModule {}
