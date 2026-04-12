import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ChatEvents } from '../constants/chat-events.constant';
import { CreateMessageDto } from '../dto/create-message.dto';
import { EditMessageDto } from '../dto/edit-message.dto';
import { MarkRoomAsReadDto } from '../dto/mark-room-read.dto';
import { ReactMessageDto } from '../dto/react-message.dto';
import {
  DeleteMessageSocketPayload,
  JoinRoomSocketPayload,
  LeaveRoomSocketPayload,
  TypingSocketPayload,
} from '../interfaces/chat-event-payloads.interface';
import { SocketAuthenticatedUser } from '../interfaces/socket-authenticated-user.interface';
import { MessagingService } from '../messaging.service';
import { ChatEventsPublisher } from './chat-events.publisher';
import { ChatGatewayAdapter } from './chat.gateway.adapter';
import { RoomBroadcastService } from './room-broadcast.service';
import { SocketSessionService } from './socket-session.service';

type AuthenticatedSocket = Socket & {
  data: {
    user?: SocketAuthenticatedUser;
  };
};

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
  },
})
export class ChatGateway
  implements OnGatewayConnection<AuthenticatedSocket>, OnGatewayDisconnect<AuthenticatedSocket>
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly messagingService: MessagingService,
    private readonly chatGatewayAdapter: ChatGatewayAdapter,
    private readonly chatEventsPublisher: ChatEventsPublisher,
    private readonly roomBroadcastService: RoomBroadcastService,
    private readonly socketSessionService: SocketSessionService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    this.chatGatewayAdapter.register(this.server);

    try {
      const user = await this.authenticateSocket(client);
      client.data.user = user;

      await this.socketSessionService.registerSocket(client.id, user);
      await client.join(this.roomBroadcastService.getUserChannel(user.userId));
      this.logger.debug(`Socket connected: ${client.id}`);
    } catch (error) {
      this.logger.warn(`Socket rejected: ${client.id}`);
      client.emit(ChatEvents.ChatError, {
        message: error instanceof Error ? error.message : 'Unauthorized',
      });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    await this.socketSessionService.unregisterSocket(client.id);
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage(ChatEvents.RoomJoin)
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinRoomSocketPayload,
  ): Promise<{ roomId: string }> {
    const user = this.getSocketUser(client);
    await this.messagingService.validateRoomAccess(user, payload.roomId);
    await client.join(this.roomBroadcastService.getRoomChannel(payload.roomId));
    this.socketSessionService.bindRoom(client.id, payload.roomId);
    return { roomId: payload.roomId };
  }

  @SubscribeMessage(ChatEvents.RoomLeave)
  async handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: LeaveRoomSocketPayload,
  ): Promise<{ roomId: string }> {
    const user = this.getSocketUser(client);
    await this.messagingService.validateRoomAccess(user, payload.roomId);
    await client.leave(this.roomBroadcastService.getRoomChannel(payload.roomId));
    this.socketSessionService.unbindRoom(client.id, payload.roomId);
    return { roomId: payload.roomId };
  }

  @SubscribeMessage(ChatEvents.MessageSend)
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: CreateMessageDto,
  ) {
    const user = this.getSocketUser(client);
    const result = await this.messagingService.sendMessage(user, payload.roomId, payload);
    this.broadcastToRoom(result.roomId, ChatEvents.MessageCreated, result.payload, user.schoolId);
    return result.payload;
  }

  @SubscribeMessage(ChatEvents.MessageEdit)
  async handleEditMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: EditMessageDto,
  ) {
    const user = this.getSocketUser(client);
    const result = await this.messagingService.editMessage(user, payload.messageId, payload);
    this.broadcastToRoom(result.roomId, ChatEvents.MessageUpdated, result.payload, user.schoolId);
    return result.payload;
  }

  @SubscribeMessage(ChatEvents.MessageDelete)
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: DeleteMessageSocketPayload,
  ) {
    const user = this.getSocketUser(client);
    const result = await this.messagingService.softDeleteMessage(user, payload.messageId);
    this.broadcastToRoom(result.roomId, ChatEvents.MessageDeleted, result.payload, user.schoolId);
    return result.payload;
  }

  @SubscribeMessage(ChatEvents.MessageReactAdd)
  async handleAddReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ReactMessageDto,
  ) {
    const user = this.getSocketUser(client);
    const result = await this.messagingService.reactToMessage(user, payload.messageId, payload);
    this.broadcastToRoom(result.roomId, ChatEvents.MessageReacted, result.payload, user.schoolId);
    return result.payload;
  }

  @SubscribeMessage(ChatEvents.MessageReactRemove)
  async handleRemoveReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ReactMessageDto,
  ) {
    const user = this.getSocketUser(client);
    const result = await this.messagingService.removeReaction(user, payload.messageId, payload);
    this.broadcastToRoom(
      result.roomId,
      ChatEvents.MessageReactRemove,
      result.payload,
      user.schoolId,
    );
    return result.payload;
  }

  @SubscribeMessage(ChatEvents.RoomRead)
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MarkRoomAsReadDto,
  ) {
    const user = this.getSocketUser(client);
    const result = await this.messagingService.markRoomAsRead(user, payload.roomId, payload);
    this.broadcastToRoom(
      result.roomId,
      ChatEvents.RoomReadUpdated,
      result.payload,
      user.schoolId,
    );
    return result.payload;
  }

  @SubscribeMessage(ChatEvents.TypingStart)
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingSocketPayload,
  ): Promise<void> {
    const user = this.getSocketUser(client);
    await this.messagingService.validateRoomParticipation(user, payload.roomId);

    const eventPayload = {
      roomId: payload.roomId,
      userId: user.userId,
      state: 'started',
      expiresAt: new Date(Date.now() + 5000).toISOString(),
    };

    await this.broadcastToRoom(
      payload.roomId,
      ChatEvents.TypingUpdated,
      eventPayload,
      user.schoolId,
    );
  }

  @SubscribeMessage(ChatEvents.TypingStop)
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingSocketPayload,
  ): Promise<void> {
    const user = this.getSocketUser(client);
    await this.messagingService.validateRoomParticipation(user, payload.roomId);

    const eventPayload = {
      roomId: payload.roomId,
      userId: user.userId,
      state: 'stopped',
      expiresAt: new Date().toISOString(),
    };

    await this.broadcastToRoom(
      payload.roomId,
      ChatEvents.TypingUpdated,
      eventPayload,
      user.schoolId,
    );
  }

  private async authenticateSocket(
    client: AuthenticatedSocket,
  ): Promise<SocketAuthenticatedUser> {
    const token = this.extractBearerToken(client);
    if (!token) {
      throw new WsException('Missing access token');
    }

    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: process.env.JWT_SECRET,
    });

    return {
      userId: payload.sub,
      schoolId: payload.schoolId,
      departmentId: payload.departmentId,
      roles: [payload.role],
      sessionId: payload.sid,
      socketId: client.id,
    };
  }

  private extractBearerToken(client: AuthenticatedSocket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.replace(/^Bearer\s+/i, '').trim();
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.trim()) {
      return header.replace(/^Bearer\s+/i, '').trim();
    }

    return null;
  }

  private async broadcastToRoom(
    roomId: string,
    eventName: string,
    payload: unknown,
    schoolId: string,
  ): Promise<void> {
    this.roomBroadcastService.emitLocalToRoom(roomId, eventName, payload);
    await this.chatEventsPublisher.publish(eventName, schoolId, payload, { roomId });
  }

  private getSocketUser(client: AuthenticatedSocket): SocketAuthenticatedUser {
    const user = client.data.user;
    if (!user) {
      throw new WsException('Unauthorized');
    }

    return user;
  }
}
