import { ForbiddenException, Injectable } from '@nestjs/common';

import { ChatUserContext } from '../interfaces/chat-user-context.interface';
import { MessagingRepository } from '../messaging.repository';

@Injectable()
export class ChatRoomTypePolicy {
  assertDepartmentAccess(
    user: ChatUserContext,
    departmentId?: string | null,
  ): void {
    if (!departmentId || user.departmentId !== departmentId) {
      throw new ForbiddenException('Department room access denied');
    }
  }

  async assertPrivateRoomAccess(
    user: ChatUserContext,
    roomId: string,
    repository: MessagingRepository,
  ): Promise<void> {
    const membership = await repository.findRoomMembership(
      user.schoolId,
      roomId,
      user.userId,
    );

    if (!membership) {
      throw new ForbiddenException('Private room access denied');
    }
  }

  async assertGroupRoomAccess(
    user: ChatUserContext,
    groupId: string | null | undefined,
    repository: MessagingRepository,
  ): Promise<void> {
    if (!groupId) {
      throw new ForbiddenException('Group room access denied');
    }

    const membership = await repository.findRoomMembership(
      user.schoolId,
      groupId,
      user.userId,
    );

    if (!membership) {
      throw new ForbiddenException('Group room access denied');
    }
  }
}
