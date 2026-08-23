import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (
  ...roles: ('USER' | 'MEMBER' | 'TEACHER' | 'DEV' | 'ADMIN')[]
) => SetMetadata(ROLES_KEY, roles);
