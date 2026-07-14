import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TagsService } from './tags.service';

class CreateTagDto {
  @IsString()
  @Length(1, 20, { message: '태그는 1~20자로 입력해주세요.' })
  name: string;
}

@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  /** 문제 등록/수정 폼의 태그 선택지 목록. */
  @Get()
  list() {
    return this.tags.list();
  }

  /** 문제 추가/수정 폼에서 새 태그를 등록한다. 문제를 만들 수 있는 부원 이상이면 가능. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER', 'ADMIN')
  @Post()
  create(@Body() dto: CreateTagDto) {
    return this.tags.create(dto.name);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tags.remove(id);
  }
}
