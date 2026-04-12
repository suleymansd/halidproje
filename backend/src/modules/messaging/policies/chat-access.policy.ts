import { ForbiddenException, Injectable } from '@nestjs/common';

import { ChatUserContext } from '../interfaces/chat-user-context.interface';

@Injectable()
export class ChatAccessPolicy {
  assertSameSchool(user: ChatUserContext, resourceSchoolId: string): void {
    if (!user.schoolId || user.schoolId !== resourceSchoolId) {
      throw new ForbiddenException('Cross-tenant access is not allowed');
    }
  }

  assertActiveMembership(
    membership: Record<string, unknown> | null,
  ): void {
    if (!membership) {
      throw new ForbiddenException('Room membership is required');
    }
  }
}
