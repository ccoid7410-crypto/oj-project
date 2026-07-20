import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/jwt.strategy';
import { ApiKeyService } from './apikey.service';

class CreateApiKeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @IsIn(['users:read'], { each: true })
  scopes?: string[];
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeys: ApiKeyService) {}

  @Get()
  list() {
    return this.apiKeys.list();
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateApiKeyDto) {
    return this.apiKeys.create(user.userId, dto.name, dto.scopes);
  }

  @Delete(':id')
  revoke(@Param('id') id: string) {
    return this.apiKeys.revoke(id);
  }
}
