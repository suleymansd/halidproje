import { ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class NotificationAccessPolicy {
  assertSameSchool(userSchoolId: string, resourceSchoolId: string): void {
    if (!userSchoolId || userSchoolId !== resourceSchoolId) {
      throw new ForbiddenException('Cross-tenant notification access is not allowed');
    }
  }

  assertOwnNotification(userId: string, ownerUserId: string): void {
    if (userId !== ownerUserId) {
      throw new ForbiddenException('Notification access denied');
    }
  }
}
