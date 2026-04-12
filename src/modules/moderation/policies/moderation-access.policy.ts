import { ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class ModerationAccessPolicy {
  assertSameSchool(userSchoolId: string, resourceSchoolId: string): void {
    if (!userSchoolId || userSchoolId !== resourceSchoolId) {
      throw new ForbiddenException('Cross-tenant moderation access is not allowed');
    }
  }
}
