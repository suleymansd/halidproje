import { AuthUser } from './auth-user.interface';

export interface AuthenticatedUser extends AuthUser {
  sessionId: string;
  roles: string[];
}
