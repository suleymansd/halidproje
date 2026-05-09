import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { ChatEvents } from './constants/chat-events.constant';
import { ChatRoomTypes } from './constants/chat-room-types.constant';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreatePrivateRoomDto } from './dto/create-private-room.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { ListRoomMessagesDto } from './dto/list-room-messages.dto';
import { ListUserRoomsDto } from './dto/list-user-rooms.dto';
import { MarkRoomAsReadDto } from './dto/mark-room-read.dto';
import { ReactMessageDto } from './dto/react-message.dto';
import { ReportMessageDto } from './dto/report-message.dto';
import { ChatUserContext } from './interfaces/chat-user-context.interface';
import { ChatAccessPolicy } from './policies/chat-access.policy';
import { ChatRoomTypePolicy } from './policies/chat-room-type.policy';
import { MessagingRepository } from './messaging.repository';
import { ChatEventsPublisher } from './gateways/chat-events.publisher';
import { RoomBroadcastService } from './gateways/room-broadcast.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTypes } from '../notifications/constants/notification-types.constant';

@Injectable()
export class MessagingService {
  constructor(
    private readonly messagingRepository: MessagingRepository,
    private readonly chatAccessPolicy: ChatAccessPolicy,
    private readonly chatRoomTypePolicy: ChatRoomTypePolicy,
    private readonly chatEventsPublisher: ChatEventsPublisher,
    private readonly roomBroadcastService: RoomBroadcastService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listUserRooms(user: ChatUserContext, query: ListUserRoomsDto) {
    const currentUser = this.normalizeUser(user);
    return this.messagingRepository.findUserRooms(
      currentUser.schoolId,
      currentUser.userId,
      query,
    );
  }

  async getRoomById(user: ChatUserContext, roomId: string) {
    const room = await this.getAccessibleRoom(this.normalizeUser(user), roomId);
    return room;
  }

  async getRoomMessages(
    user: ChatUserContext,
    roomId: string,
    query: ListRoomMessagesDto,
  ) {
    const currentUser = this.normalizeUser(user);
    await this.getAccessibleRoom(currentUser, roomId);
    return this.messagingRepository.findRoomMessages(
      currentUser.schoolId,
      roomId,
      query,
      currentUser.userId,
    );
  }

  async createOrGetPrivateRoom(
    user: ChatUserContext,
    dto: CreatePrivateRoomDto,
  ) {
    const currentUser = this.normalizeUser(user);

    if (dto.targetUserId === currentUser.userId) {
      throw new BadRequestException('Cannot create a private room with yourself');
    }

    const targetUser = await this.messagingRepository.findUserById(
      currentUser.schoolId,
      dto.targetUserId,
    );

    if (!targetUser) {
      throw new NotFoundException('Target user not found in this school');
    }

    const existingRoom = await this.messagingRepository.findPrivateRoomBetweenUsers(
      currentUser.schoolId,
      currentUser.userId,
      dto.targetUserId,
    );

    if (existingRoom) {
      return existingRoom;
    }

    return this.messagingRepository.createPrivateRoom(
      currentUser.schoolId,
      currentUser.userId,
      dto.targetUserId,
    );
  }

  async startDirectMessage(
    user: ChatUserContext,
    dto: CreatePrivateRoomDto,
  ): Promise<{ roomId: string; roomType: string }> {
    const room = await this.createOrGetPrivateRoom(user, dto);
    return {
      roomId: String(room.id),
      roomType: String(room.roomType ?? ChatRoomTypes.Private),
    };
  }

  async sendMessage(
    user: ChatUserContext,
    roomId: string,
    dto: CreateMessageDto,
  ) {
    const currentUser = this.normalizeUser(user);
    const room = await this.getAccessibleRoom(currentUser, roomId);
    await this.ensureCanParticipate(currentUser, roomId);

    if (dto.attachmentIds?.length) {
      throw new BadRequestException('Attachment sending is not available yet');
    }

    if (dto.replyToMessageId) {
      const replyTarget = await this.messagingRepository.findMessageById(
        currentUser.schoolId,
        dto.replyToMessageId,
        currentUser.userId,
      );

      if (!replyTarget || replyTarget.roomId !== roomId) {
        throw new BadRequestException('Reply target must belong to the same room');
      }
    }

    const message = await this.messagingRepository.createMessage(currentUser.schoolId, {
      roomId,
      senderId: currentUser.userId,
      body: dto.content.trim(),
      replyToMessageId: dto.replyToMessageId,
      attachmentIds: dto.attachmentIds ?? [],
    });

    this.roomBroadcastService.emitLocalToRoom(
      roomId,
      ChatEvents.MessageCreated,
      message,
    );
    await this.chatEventsPublisher.publish(
      ChatEvents.MessageCreated,
      currentUser.schoolId,
      message,
      { roomId },
    );

    await this.notifyMessageRecipients(currentUser, room, message);

    return {
      event: ChatEvents.MessageCreated,
      roomId,
      payload: message,
    };
  }

  async editMessage(
    user: ChatUserContext,
    messageId: string,
    dto: EditMessageDto,
  ) {
    const currentUser = this.normalizeUser(user);
    const message = await this.getAccessibleMessage(currentUser, messageId);
    if (message.senderId !== currentUser.userId) {
      throw new ForbiddenException('Only the sender can edit this message');
    }

    if (message.isDeleted) {
      throw new BadRequestException('Deleted messages cannot be edited');
    }

    const updated = await this.messagingRepository.updateMessage(
      currentUser.schoolId,
      messageId,
      {
        body: dto.content.trim(),
        editorId: currentUser.userId,
      },
    );

    return {
      event: ChatEvents.MessageUpdated,
      roomId: message.roomId,
      payload: updated,
    };
  }

  async softDeleteMessage(user: ChatUserContext, messageId: string) {
    const currentUser = this.normalizeUser(user);
    const message = await this.getAccessibleMessage(currentUser, messageId);
    const canModerate = this.hasModerationPrivileges(currentUser);

    if (message.senderId !== currentUser.userId && !canModerate) {
      throw new ForbiddenException('Message delete is not allowed');
    }

    if (message.isDeleted) {
      return {
        event: ChatEvents.MessageDeleted,
        roomId: message.roomId,
        payload: message,
      };
    }

    const deleted = await this.messagingRepository.softDeleteMessage(
      currentUser.schoolId,
      messageId,
      currentUser.userId,
    );

    return {
      event: ChatEvents.MessageDeleted,
      roomId: message.roomId,
      payload: deleted,
    };
  }

  async reactToMessage(
    user: ChatUserContext,
    messageId: string,
    dto: ReactMessageDto,
  ) {
    const currentUser = this.normalizeUser(user);
    const message = await this.getAccessibleMessage(currentUser, messageId);
    await this.ensureCanParticipate(currentUser, message.roomId);

    if (message.isDeleted) {
      throw new BadRequestException('Cannot react to a deleted message');
    }

    const reaction = await this.messagingRepository.upsertReaction(currentUser.schoolId, {
      messageId,
      userId: currentUser.userId,
      reaction: dto.reaction.trim(),
    });

    return {
      event: ChatEvents.MessageReacted,
      roomId: message.roomId,
      payload: reaction,
    };
  }

  async removeReaction(
    user: ChatUserContext,
    messageId: string,
    dto: ReactMessageDto,
  ) {
    const currentUser = this.normalizeUser(user);
    const message = await this.getAccessibleMessage(currentUser, messageId);
    await this.ensureCanParticipate(currentUser, message.roomId);

    const reaction = await this.messagingRepository.removeReaction(currentUser.schoolId, {
      messageId,
      userId: currentUser.userId,
      reaction: dto.reaction.trim(),
    });

    return {
      event: ChatEvents.MessageReactRemove,
      roomId: message.roomId,
      payload: reaction,
    };
  }

  async markRoomAsRead(
    user: ChatUserContext,
    roomId: string,
    dto: MarkRoomAsReadDto,
  ) {
    const currentUser = this.normalizeUser(user);
    await this.ensureCanParticipate(currentUser, roomId);

    const message = await this.messagingRepository.findMessageById(
      currentUser.schoolId,
      dto.lastReadMessageId,
      currentUser.userId,
    );

    if (!message || message.roomId !== roomId) {
      throw new BadRequestException('lastReadMessageId must belong to the same room');
    }

    const readState = await this.messagingRepository.markReadState(currentUser.schoolId, {
      roomId,
      userId: currentUser.userId,
      lastReadMessageId: dto.lastReadMessageId,
    });

    return {
      event: ChatEvents.RoomReadUpdated,
      roomId,
      payload: readState,
    };
  }

  async reportMessage(
    user: ChatUserContext,
    messageId: string,
    dto: ReportMessageDto,
  ) {
    const currentUser = this.normalizeUser(user);
    const message = await this.getAccessibleMessage(currentUser, messageId);
    await this.ensureCanParticipate(currentUser, message.roomId);

    const report = await this.messagingRepository.createMessageReport(
      currentUser.schoolId,
      {
        messageId,
        reporterId: currentUser.userId,
        reason: dto.reason,
        description: dto.description,
      },
    );

    return report;
  }

  async validateRoomAccess(user: ChatUserContext, roomId: string) {
    await this.getAccessibleRoom(this.normalizeUser(user), roomId);
  }

  async validateRoomParticipation(user: ChatUserContext, roomId: string) {
    await this.ensureCanParticipate(this.normalizeUser(user), roomId);
  }

  private async getAccessibleRoom(user: ChatUserContext, roomId: string) {
    const room = await this.messagingRepository.findRoomById(
      user.schoolId,
      roomId,
      user.userId,
    );

    if (!room) {
      throw new NotFoundException('Chat room not found');
    }

    await this.assertCanAccessRoom(user, room);
    return room;
  }

  private async getAccessibleMessage(user: ChatUserContext, messageId: string) {
    const message = await this.messagingRepository.findMessageById(
      user.schoolId,
      messageId,
      user.userId,
    );

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.getAccessibleRoom(user, message.roomId as string);
    return message as {
      roomId: string;
      senderId: string;
      isDeleted: boolean;
    };
  }

  private async assertCanAccessRoom(
    user: ChatUserContext,
    room: {
      id: string;
      schoolId: string;
      roomType?: string;
      departmentId?: string | null;
      groupId?: string | null;
    },
  ): Promise<void> {
    this.chatAccessPolicy.assertSameSchool(user, room.schoolId);

    switch (room.roomType) {
      case ChatRoomTypes.Department:
        this.chatRoomTypePolicy.assertDepartmentAccess(user, room.departmentId);
        break;
      case ChatRoomTypes.Private:
        await this.chatRoomTypePolicy.assertPrivateRoomAccess(
          user,
          room.id,
          this.messagingRepository,
        );
        break;
      case ChatRoomTypes.Group:
        await this.chatRoomTypePolicy.assertGroupRoomAccess(
          user,
          room.id,
          room.groupId,
          this.messagingRepository,
        );
        break;
      case ChatRoomTypes.General:
      default:
        break;
    }
  }

  private async ensureCanParticipate(
    user: ChatUserContext,
    roomId: string,
  ): Promise<void> {
    await this.getAccessibleRoom(user, roomId);
    const membership = await this.messagingRepository.findRoomMembership(
      user.schoolId,
      roomId,
      user.userId,
    );

    this.chatAccessPolicy.assertActiveMembership(membership);
  }

  private hasModerationPrivileges(user: ChatUserContext): boolean {
    return user.roles.some((role) =>
      ['super_admin', 'school_admin', 'moderator'].includes(role),
    );
  }

  private normalizeUser(user: ChatUserContext): ChatUserContext & { userId: string } {
    const userId = user.userId ?? user.id;

    if (!userId || !user.schoolId) {
      throw new UnauthorizedException('Authentication required');
    }

    return {
      ...user,
      userId,
    };
  }

  private async notifyMessageRecipients(
    sender: ChatUserContext & { userId: string },
    room: {
      id: string;
      roomType?: string;
      name?: string | null;
    },
    message: Record<string, any>,
  ): Promise<void> {
    if (room.roomType !== ChatRoomTypes.Private && room.roomType !== ChatRoomTypes.Group) {
      return;
    }

    const memberIds = await this.messagingRepository.findRoomMemberUserIds(
      sender.schoolId,
      room.id,
    );
    const recipientIds = memberIds.filter((memberId) => memberId !== sender.userId);

    if (recipientIds.length === 0) {
      return;
    }

    const title =
      room.roomType === ChatRoomTypes.Private
        ? 'New direct message'
        : `New message in ${room.name ?? 'group room'}`;

    const content = message.content ? String(message.content) : '[attachment]';

    for (const recipientId of recipientIds) {
      const notification = await this.notificationsService.createNotification({
        schoolId: sender.schoolId,
        userId: recipientId,
        type: NotificationTypes.NewDirectMessage,
        title,
        body: content.slice(0, 1000),
        referenceType: 'chat_room',
        referenceId: room.id,
        metadata: {
          roomId: room.id,
          senderId: sender.userId,
          messageId: message.id,
        },
      });

      const payload = {
        id: notification.id,
        title: notification.title,
        content: notification.content,
        type: 'message',
        relatedId: room.id,
        createdAt: notification.createdAt,
      };

      this.roomBroadcastService.emitLocalToRoom(
        this.roomBroadcastService.getUserChannel(recipientId),
        ChatEvents.NotificationCreated,
        payload,
      );
      await this.chatEventsPublisher.publish(
        ChatEvents.NotificationCreated,
        sender.schoolId,
        payload,
        { userId: recipientId },
      );
    }
  }
}
