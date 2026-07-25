import type { Request } from 'express';
import type { RequestUser } from '../auth/jwt.strategy';

export interface OptionalAuthRequest extends Request {
  user?: RequestUser;
}

export interface AuthenticatedRequest extends Request {
  user: RequestUser;
}
