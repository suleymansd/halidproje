import { Injectable } from '@nestjs/common';

type PresenceStatus = 'online' | 'offline';

export interface PresenceState {
  userId: string;
  status: PresenceStatus;
  lastSeen: string;
}

@Injectable()
export class PresenceService {
  private readonly userSockets = new Map<string, Set<string>>();
  private readonly lastSeenByUser = new Map<string, string>();

  markOnline(userId: string, socketId: string): { state: PresenceState; becameOnline: boolean } {
    const sockets = this.userSockets.get(userId) ?? new Set<string>();
    const wasOffline = sockets.size === 0;
    sockets.add(socketId);
    this.userSockets.set(userId, sockets);

    const nowIso = new Date().toISOString();
    if (!this.lastSeenByUser.has(userId)) {
      this.lastSeenByUser.set(userId, nowIso);
    }

    return {
      state: this.getPresence(userId),
      becameOnline: wasOffline,
    };
  }

  markOffline(userId: string, socketId: string): { state: PresenceState; becameOffline: boolean } {
    const sockets = this.userSockets.get(userId);
    if (!sockets) {
      const state = this.getPresence(userId);
      return { state, becameOffline: false };
    }

    sockets.delete(socketId);
    if (sockets.size > 0) {
      this.userSockets.set(userId, sockets);
      return {
        state: this.getPresence(userId),
        becameOffline: false,
      };
    }

    this.userSockets.delete(userId);
    const nowIso = new Date().toISOString();
    this.lastSeenByUser.set(userId, nowIso);
    return {
      state: this.getPresence(userId),
      becameOffline: true,
    };
  }

  getPresence(userId: string): PresenceState {
    const status: PresenceStatus = this.isOnline(userId) ? 'online' : 'offline';
    const lastSeen = this.lastSeenByUser.get(userId) ?? new Date().toISOString();
    return {
      userId,
      status,
      lastSeen,
    };
  }

  private isOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return Boolean(sockets && sockets.size > 0);
  }
}
