import { Controller, Get } from '@nestjs/common';
import { PatchNotesService } from './patch-notes.service';

@Controller('patch-notes')
export class PatchNotesController {
  constructor(private readonly patchNotesService: PatchNotesService) {}

  @Get()
  async getPatchNotes() {
    return this.patchNotesService.getCommits();
  }
}
