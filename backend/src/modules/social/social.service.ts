import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { RespondFriendRequestDto } from './dto/respond-friend-request.dto';
import { SocialRepository } from './social.repository';

@Injectable()
export class SocialService {
  constructor(private readonly socialRepository: SocialRepository) {}

  async getFriends(user: CurrentUser) {
    return this.socialRepository.listFriends(user.schoolId, user.id);
  }

  async createFriendRequest(user: CurrentUser, dto: CreateFriendRequestDto) {
    if (dto.recipientId === user.id) {
      throw new BadRequestException('You cannot send a friend request to yourself');
    }

    const targetUser = await this.socialRepository.findUserById(
      user.schoolId,
      dto.recipientId,
    );
    if (!targetUser) {
      throw new NotFoundException('Recipient not found in this school');
    }

    const block = await this.socialRepository.isBlockedBetweenUsers(
      user.schoolId,
      user.id,
      dto.recipientId,
    );
    if (block) {
      throw new ForbiddenException('Friend requests are not allowed between blocked users');
    }

    const existing = await this.socialRepository.findFriendRequestBetweenUsers(
      user.schoolId,
      user.id,
      dto.recipientId,
    );

    if (existing?.status === 'accepted') {
      return { status: 'friends', requestId: String(existing.id) };
    }

    if (existing?.status === 'pending' && existing.requester_id !== user.id) {
      return { status: 'incoming_request_exists', requestId: String(existing.id) };
    }

    const request = await this.socialRepository.upsertFriendRequest(
      user.schoolId,
      user.id,
      dto.recipientId,
    );

    return {
      status: 'pending',
      requestId: String(request.id),
    };
  }

  async respondToFriendRequest(
    user: CurrentUser,
    requestId: string,
    dto: RespondFriendRequestDto,
  ) {
    const request = await this.socialRepository.findFriendRequestById(
      user.schoolId,
      requestId,
    );

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.recipient_id !== user.id) {
      throw new ForbiddenException('Only the recipient can respond to this request');
    }

    if (request.status !== 'pending') {
      return {
        requestId: String(request.id),
        status: String(request.status),
      };
    }

    const status = dto.action === 'accept' ? 'accepted' : 'rejected';
    const updated = await this.socialRepository.respondToFriendRequest(
      user.schoolId,
      requestId,
      status,
    );

    return {
      requestId: String(updated?.id ?? request.id),
      status: String(updated?.status ?? status),
    };
  }

  async getFollows(user: CurrentUser) {
    return this.socialRepository.listFollows(user.schoolId, user.id);
  }

  async followUser(user: CurrentUser, targetUserId: string) {
    if (targetUserId === user.id) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const targetUser = await this.socialRepository.findUserById(
      user.schoolId,
      targetUserId,
    );
    if (!targetUser) {
      throw new NotFoundException('Target user not found in this school');
    }

    const block = await this.socialRepository.isBlockedBetweenUsers(
      user.schoolId,
      user.id,
      targetUserId,
    );
    if (block) {
      throw new ForbiddenException('Follow is not allowed between blocked users');
    }

    return this.socialRepository.createFollow(user.schoolId, user.id, targetUserId);
  }

  async unfollowUser(user: CurrentUser, targetUserId: string) {
    return this.socialRepository.removeFollow(user.schoolId, user.id, targetUserId);
  }

  async getBlocks(user: CurrentUser) {
    return this.socialRepository.listBlocks(user.schoolId, user.id);
  }

  async blockUser(user: CurrentUser, targetUserId: string) {
    if (targetUserId === user.id) {
      throw new BadRequestException('You cannot block yourself');
    }

    const targetUser = await this.socialRepository.findUserById(
      user.schoolId,
      targetUserId,
    );
    if (!targetUser) {
      throw new NotFoundException('Target user not found in this school');
    }

    return this.socialRepository.createBlock(user.schoolId, user.id, targetUserId);
  }

  async unblockUser(user: CurrentUser, targetUserId: string) {
    return this.socialRepository.removeBlock(user.schoolId, user.id, targetUserId);
  }

  async getRelationshipState(user: CurrentUser, targetUserId: string) {
    const targetUser = await this.socialRepository.findUserById(
      user.schoolId,
      targetUserId,
    );
    if (!targetUser) {
      throw new NotFoundException('Target user not found in this school');
    }

    const state = await this.socialRepository.getRelationshipState(
      user.schoolId,
      user.id,
      targetUserId,
    );

    return {
      targetUserId,
      isSelf: targetUserId === user.id,
      ...state,
    };
  }
}
