import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

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
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    // TODO: Validate JWT from handshake and populate client.data.user securely.
    this.chatGatewayAdapter.register(this.server);
    const user = this.getSocketUser(client);
    await this.socketSessionService.registerSocket(client.id, user);
    client.join(this.roomBroadcastService.getUserChannel(user.userId)).catch(() => undefined);
    this.logger.debug(`Socket connected: ${client.id}`);
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    // TODO: Clear presence and typing state for disconnected socket.
    await this.socketSessionService.unregisterSocket(client.id);
    this.logger.debug(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage(ChatEvents.RoomJoin)
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinRoomSocketPayload,
  ): Promise<void> {
    // TODO: Resolve authenticated user, validate membership, and subscribe socket to room channel.
    await client.join(this.roomBroadcastService.getRoomChannel(payload.roomId));
    this.socketSessionService.bindRoom(client.id, payload.roomId);
  }

  @SubscribeMessage(ChatEvents.RoomLeave)
  async handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: LeaveRoomSocketPayload,
  ): Promise<void> {
    // TODO: Remove socket subscription for the room where allowed.
    await client.leave(this.roomBroadcastService.getRoomChannel(payload.roomId));
    this.socketSessionService.unbindRoom(client.id, payload.roomId);
  }

  @SubscribeMessage(ChatEvents.MessageSend)
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: CreateMessageDto,
  ) {
    const user = this.getSocketUser(client);
    const result = await this.messagingService.sendMessage(user, payload.roomId, payload);
    this.roomBroadcastService.emitLocalToRoom(payload.roomId, ChatEvents.MessageCreated, result);
    await this.chatEventsPublisher.publish(
      ChatEvents.MessageCreated,
      user.schoolId,
      result,
      { roomId: payload.roomId },
    );
    return result;
  }

  @SubscribeMessage(ChatEvents.MessageEdit)
  async handleEditMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: EditMessageDto,
  ) {
    const user = this.getSocketUser(client);
    const result = await this.messagingService.editMessage(user, payload.messageId, payload);
    await this.chatEventsPublisher.publish(
      ChatEvents.MessageUpdated,
      user.schoolId,
      result,
    );
    return result;
  }

  @SubscribeMessage(ChatEvents.MessageDelete)
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: DeleteMessageSocketPayload,
  ) {
    const user = this.getSocketUser(client);
    const result = await this.messagingService.softDeleteMessage(user, payload.messageId);
    await this.chatEventsPublisher.publish(
      ChatEvents.MessageDeleted,
      user.schoolId,
      result,
    );
    return result;
  }

  @SubscribeMessage(ChatEvents.MessageReactAdd)
  async handleAddReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ReactMessageDto,
  ) {
    const user = this.getSocketUser(client);
    const result = await this.messagingService.reactToMessage(user, payload.messageId, payload);
    await this.chatEventsPublisher.publish(
      ChatEvents.MessageReacted,
      user.schoolId,
      result,
    );
    return result;
  }

  @SubscribeMessage(ChatEvents.MessageReactRemove)
  async handleRemoveReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ReactMessageDto,
  ) {
    const user = this.getSocketUser(client);
    const result = await this.messagingService.removeReaction(user, payload.messageId, payload);
    await this.chatEventsPublisher.publish(
      ChatEvents.MessageReactRemove,
      user.schoolId,
      { messageId: payload.messageId, reactionType: payload.reaction },
    );
    return result;
  }

  @SubscribeMessage(ChatEvents.RoomRead)
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MarkRoomAsReadDto,
  ) {
    const user = this.getSocketUser(client);
    const result = await this.messagingService.markRoomAsRead(user, payload.roomId, payload);
    await this.chatEventsPublisher.publish(
      ChatEvents.RoomReadUpdated,
      user.schoolId,
      result,
      { roomId: payload.roomId },
    );
    return result;
  }

  @SubscribeMessage(ChatEvents.TypingStart)
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingSocketPayload,
  ): Promise<void> {
    // TODO: Broadcast ephemeral typing.start event via Redis-backed presence layer.
    const user = this.getSocketUser(client);
    const eventPayload = {
      roomId: payload.roomId,
      userId: user.userId,
      state: 'started',
      expiresAt: new Date(Date.now() + 5000).toISOString(),
    };
    this.roomBroadcastService.emitLocalToRoom(
      payload.roomId,
      ChatEvents.TypingUpdated,
      eventPayload,
    );
    await this.chatEventsPublisher.publish(
      ChatEvents.TypingUpdated,
      user.schoolId,
      eventPayload,
      { roomId: payload.roomId },
    );
  }

  @SubscribeMessage(ChatEvents.TypingStop)
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingSocketPayload,
  ): Promise<void> {
    // TODO: Broadcast ephemeral typing.stop event via Redis-backed presence layer.
    const user = this.getSocketUser(client);
    const eventPayload = {
      roomId: payload.roomId,
      userId: user.userId,
      state: 'stopped',
      expiresAt: new Date().toISOString(),
    };
    this.roomBroadcastService.emitLocalToRoom(
      payload.roomId,
      ChatEvents.TypingUpdated,
      eventPayload,
    );
    await this.chatEventsPublisher.publish(
      ChatEvents.TypingUpdated,
      user.schoolId,
      eventPayload,
      { roomId: payload.roomId },
    );
  }

  private getSocketUser(client: AuthenticatedSocket): SocketAuthenticatedUser {
    return (
      client.data.user ?? {
        userId: '',
        schoolId: '',
        roles: [],
      }
    );
  }
}
