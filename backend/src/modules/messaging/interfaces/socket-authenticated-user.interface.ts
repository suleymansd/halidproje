import { ChatUserContext } from './chat-user-context.interface';

export interface SocketAuthenticatedUser extends ChatUserContext {
  sessionId?: string;
  socketId?: string;
  username?: string | null;
  email?: string | null;
}
