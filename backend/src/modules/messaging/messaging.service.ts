import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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

@Injectable()
export class MessagingService {
  constructor(
    private readonly messagingRepository: MessagingRepository,
    private readonly chatAccessPolicy: ChatAccessPolicy,
    private readonly chatRoomTypePolicy: ChatRoomTypePolicy,
  ) {}

  async listUserRooms(user: ChatUserContext, query: ListUserRoomsDto) {
    return this.messagingRepository.findUserRooms(user.schoolId, user.userId, query);
  }

  async getRoomById(user: ChatUserContext, roomId: string) {
    const room = await this.getAccessibleRoom(user, roomId);
    return room;
  }

  async getRoomMessages(
    user: ChatUserContext,
    roomId: string,
    query: ListRoomMessagesDto,
  ) {
    await this.getAccessibleRoom(user, roomId);
    return this.messagingRepository.findRoomMessages(
      user.schoolId,
      roomId,
      query,
      user.userId,
    );
  }

  async createOrGetPrivateRoom(
    user: ChatUserContext,
    dto: CreatePrivateRoomDto,
  ) {
    if (dto.targetUserId === user.userId) {
      throw new BadRequestException('Cannot create a private room with yourself');
    }

    const targetUser = await this.messagingRepository.findUserById(
      user.schoolId,
      dto.targetUserId,
    );

    if (!targetUser) {
      throw new NotFoundException('Target user not found in this school');
    }

    const existingRoom = await this.messagingRepository.findPrivateRoomBetweenUsers(
      user.schoolId,
      user.userId,
      dto.targetUserId,
    );

    if (existingRoom) {
      return existingRoom;
    }

    return this.messagingRepository.createPrivateRoom(
      user.schoolId,
      user.userId,
      dto.targetUserId,
    );
  }

  async sendMessage(
    user: ChatUserContext,
    roomId: string,
    dto: CreateMessageDto,
  ) {
    await this.ensureCanParticipate(user, roomId);

    if (dto.attachmentIds?.length) {
      throw new BadRequestException('Attachment sending is not available yet');
    }

    if (dto.replyToMessageId) {
      const replyTarget = await this.messagingRepository.findMessageById(
        user.schoolId,
        dto.replyToMessageId,
        user.userId,
      );

      if (!replyTarget || replyTarget.roomId !== roomId) {
        throw new BadRequestException('Reply target must belong to the same room');
      }
    }

    const message = await this.messagingRepository.createMessage(user.schoolId, {
      roomId,
      senderId: user.userId,
      body: dto.content.trim(),
      replyToMessageId: dto.replyToMessageId,
      attachmentIds: dto.attachmentIds ?? [],
    });

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
    const message = await this.getAccessibleMessage(user, messageId);
    if (message.senderId !== user.userId) {
      throw new ForbiddenException('Only the sender can edit this message');
    }

    if (message.isDeleted) {
      throw new BadRequestException('Deleted messages cannot be edited');
    }

    const updated = await this.messagingRepository.updateMessage(
      user.schoolId,
      messageId,
      {
        body: dto.content.trim(),
        editorId: user.userId,
      },
    );

    return {
      event: ChatEvents.MessageUpdated,
      roomId: message.roomId,
      payload: updated,
    };
  }

  async softDeleteMessage(user: ChatUserContext, messageId: string) {
    const message = await this.getAccessibleMessage(user, messageId);
    const canModerate = this.hasModerationPrivileges(user);

    if (message.senderId !== user.userId && !canModerate) {
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
      user.schoolId,
      messageId,
      user.userId,
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
    const message = await this.getAccessibleMessage(user, messageId);
    await this.ensureCanParticipate(user, message.roomId);

    if (message.isDeleted) {
      throw new BadRequestException('Cannot react to a deleted message');
    }

    const reaction = await this.messagingRepository.upsertReaction(user.schoolId, {
      messageId,
      userId: user.userId,
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
    const message = await this.getAccessibleMessage(user, messageId);
    await this.ensureCanParticipate(user, message.roomId);

    const reaction = await this.messagingRepository.removeReaction(user.schoolId, {
      messageId,
      userId: user.userId,
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
    await this.ensureCanParticipate(user, roomId);

    const message = await this.messagingRepository.findMessageById(
      user.schoolId,
      dto.lastReadMessageId,
      user.userId,
    );

    if (!message || message.roomId !== roomId) {
      throw new BadRequestException('lastReadMessageId must belong to the same room');
    }

    const readState = await this.messagingRepository.markReadState(user.schoolId, {
      roomId,
      userId: user.userId,
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
    const message = await this.getAccessibleMessage(user, messageId);
    await this.ensureCanParticipate(user, message.roomId);

    const report = await this.messagingRepository.createMessageReport(
      user.schoolId,
      {
        messageId,
        reporterId: user.userId,
        reason: dto.reason,
        description: dto.description,
      },
    );

    return report;
  }

  async validateRoomAccess(user: ChatUserContext, roomId: string) {
    await this.getAccessibleRoom(user, roomId);
  }

  async validateRoomParticipation(user: ChatUserContext, roomId: string) {
    await this.ensureCanParticipate(user, roomId);
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
}
