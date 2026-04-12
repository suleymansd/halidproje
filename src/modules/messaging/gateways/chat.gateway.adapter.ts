import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class ChatGatewayAdapter {
  private server?: Server;

  register(server: Server): void {
    this.server = server;
  }

  emitToRoom(roomKey: string, eventName: string, payload: unknown): void {
    this.server?.to(roomKey).emit(eventName, payload);
  }

  emitToSocket(socketId: string, eventName: string, payload: unknown): void {
    this.server?.to(socketId).emit(eventName, payload);
  }

  emitToManySockets(socketIds: string[], eventName: string, payload: unknown): void {
    if (socketIds.length === 0) {
      return;
    }

    for (const socketId of socketIds) {
      this.emitToSocket(socketId, eventName, payload);
    }
  }
}
