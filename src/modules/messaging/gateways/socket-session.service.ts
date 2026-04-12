import { Injectable } from '@nestjs/common';

import { RedisService } from '../../../infrastructure/redis/redis.service';
import { SocketAuthenticatedUser } from '../interfaces/socket-authenticated-user.interface';

interface SocketSessionRecord {
  socketId: string;
  user: SocketAuthenticatedUser;
  roomIds: Set<string>;
}

@Injectable()
export class SocketSessionService {
  private readonly socketSessions = new Map<string, SocketSessionRecord>();
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(private readonly redisService: RedisService) {}

  async registerSocket(socketId: string, user: SocketAuthenticatedUser): Promise<void> {
    this.socketSessions.set(socketId, {
      socketId,
      user,
      roomIds: new Set<string>(),
    });

    const sockets = this.userSockets.get(user.userId) ?? new Set<string>();
    sockets.add(socketId);
    this.userSockets.set(user.userId, sockets);

    // TODO: Mirror user/socket presence into Redis for cross-instance presence tracking.
    await this.redisService.setAdd(this.getUserSocketsKey(user.userId), socketId);
  }

  async unregisterSocket(socketId: string): Promise<void> {
    const session = this.socketSessions.get(socketId);
    if (!session) {
      return;
    }

    this.socketSessions.delete(socketId);

    const sockets = this.userSockets.get(session.user.userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(session.user.userId);
      }
    }

    // TODO: Remove distributed presence and typing markers for this socket.
    await this.redisService.setRemove(this.getUserSocketsKey(session.user.userId), socketId);
  }

  bindRoom(socketId: string, roomId: string): void {
    const session = this.socketSessions.get(socketId);
    if (!session) {
      return;
    }

    session.roomIds.add(roomId);
  }

  unbindRoom(socketId: string, roomId: string): void {
    const session = this.socketSessions.get(socketId);
    if (!session) {
      return;
    }

    session.roomIds.delete(roomId);
  }

  getSocketUser(socketId: string): SocketAuthenticatedUser | undefined {
    return this.socketSessions.get(socketId)?.user;
  }

  getUserSocketIds(userId: string): string[] {
    return Array.from(this.userSockets.get(userId) ?? []);
  }

  getSocketRoomIds(socketId: string): string[] {
    return Array.from(this.socketSessions.get(socketId)?.roomIds ?? []);
  }

  private getUserSocketsKey(userId: string): string {
    return `presence:user:${userId}:sockets`;
  }
}
