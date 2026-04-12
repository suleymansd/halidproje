import {
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
    const room = await this.messagingRepository.findRoomById(user.schoolId, roomId);

    if (!room) {
      throw new NotFoundException('Chat room not found');
    }

    await this.assertCanAccessRoom(user, room);
    return room;
  }

  async getRoomMessages(
    user: ChatUserContext,
    roomId: string,
    query: ListRoomMessagesDto,
  ) {
    const room = await this.getRoomById(user, roomId);
    return this.messagingRepository.findRoomMessages(user.schoolId, room.id, query);
  }

  async createOrGetPrivateRoom(
    user: ChatUserContext,
    dto: CreatePrivateRoomDto,
  ) {
    if (dto.targetUserId === user.userId) {
      throw new ForbiddenException('Cannot create a private room with yourself');
    }

    const existingRoom = await this.messagingRepository.findPrivateRoomBetweenUsers(
      user.schoolId,
      user.userId,
      dto.targetUserId,
    );

    if (existingRoom) {
      return existingRoom;
    }

    // TODO: validate target user, blocking rules, and transaction boundaries.
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
    const room = await this.getRoomById(user, roomId);
    await this.ensureActiveMembership(user, room.id);

    // TODO: validate reply target and attachment ownership before persisting.
    const message = await this.messagingRepository.createMessage(user.schoolId, {
      roomId: room.id,
      senderId: user.userId,
      body: dto.content,
      replyToMessageId: dto.replyToMessageId,
      attachmentIds: dto.attachmentIds ?? [],
    });

    return {
      event: ChatEvents.MessageCreated,
      roomType: room.roomType ?? ChatRoomTypes.General,
      payload: message,
    };
  }

  async editMessage(
    user: ChatUserContext,
    messageId: string,
    dto: EditMessageDto,
  ) {
    // TODO: load message and enforce ownership or moderator override.
    return this.messagingRepository.updateMessage(user.schoolId, messageId, {
      body: dto.content,
      editorId: user.userId,
    });
  }

  async softDeleteMessage(user: ChatUserContext, messageId: string) {
    // TODO: load message and enforce sender/moderator delete policy.
    return this.messagingRepository.softDeleteMessage(
      user.schoolId,
      messageId,
      user.userId,
    );
  }

  async reactToMessage(
    user: ChatUserContext,
    messageId: string,
    dto: ReactMessageDto,
  ) {
    // TODO: load message, validate room membership, and reject deleted messages.
    return this.messagingRepository.upsertReaction(user.schoolId, {
      messageId,
      userId: user.userId,
      reaction: dto.reaction,
    });
  }

  async removeReaction(
    user: ChatUserContext,
    messageId: string,
    dto: ReactMessageDto,
  ) {
    return this.messagingRepository.removeReaction(user.schoolId, {
      messageId,
      userId: user.userId,
      reaction: dto.reaction,
    });
  }

  async markRoomAsRead(
    user: ChatUserContext,
    roomId: string,
    dto: MarkRoomAsReadDto,
  ) {
    const room = await this.getRoomById(user, roomId);
    await this.ensureActiveMembership(user, room.id);

    return this.messagingRepository.markReadState(user.schoolId, {
      roomId: room.id,
      userId: user.userId,
      lastReadMessageId: dto.lastReadMessageId,
    });
  }

  async reportMessage(
    user: ChatUserContext,
    messageId: string,
    dto: ReportMessageDto,
  ) {
    // TODO: load message, validate room visibility, and enrich moderation metadata.
    return this.messagingRepository.createMessageReport(user.schoolId, {
      messageId,
      reporterId: user.userId,
      reason: dto.reason,
      description: dto.description,
    });
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
          room.groupId,
          this.messagingRepository,
        );
        break;
      case ChatRoomTypes.General:
      default:
        break;
    }
  }

  private async ensureActiveMembership(
    user: ChatUserContext,
    roomId: string,
  ): Promise<void> {
    const membership = await this.messagingRepository.findRoomMembership(
      user.schoolId,
      roomId,
      user.userId,
    );

    this.chatAccessPolicy.assertActiveMembership(membership);
  }
}
