import { Injectable } from '@nestjs/common';

import { ChatGatewayAdapter } from './chat.gateway.adapter';
import { DistributedChatEvent } from './distributed-chat-event.interface';

@Injectable()
export class RoomBroadcastService {
  constructor(private readonly gatewayAdapter: ChatGatewayAdapter) {}

  emitLocalToRoom(roomId: string, eventName: string, payload: unknown): void {
    this.gatewayAdapter.emitToRoom(this.getRoomChannel(roomId), eventName, payload);
  }

  emitLocalToUserSockets(
    socketIds: string[],
    eventName: string,
    payload: unknown,
  ): void {
    this.gatewayAdapter.emitToManySockets(socketIds, eventName, payload);
  }

  handleDistributedEvent(event: DistributedChatEvent): void {
    if (event.roomId) {
      this.emitLocalToRoom(event.roomId, event.eventName, event.payload);
    }

    if (event.userId) {
      this.gatewayAdapter.emitToRoom(this.getUserChannel(event.userId), event.eventName, event.payload);
    }
  }

  getRoomChannel(roomId: string): string {
    return `room:${roomId}`;
  }

  getUserChannel(userId: string): string {
    return `user:${userId}`;
  }
}
