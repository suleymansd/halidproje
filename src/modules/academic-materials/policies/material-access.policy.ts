import { ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class MaterialAccessPolicy {
  assertSameSchool(userSchoolId: string, resourceSchoolId: string): void {
    if (!userSchoolId || userSchoolId !== resourceSchoolId) {
      throw new ForbiddenException('Cross-tenant material access is not allowed');
    }
  }

  assertOwnerOrModerator(
    user: { id: string; roles: string[] },
    ownerId: string,
  ): void {
    if (user.id === ownerId) {
      return;
    }

    if (user.roles.includes('moderator') || user.roles.includes('school_admin')) {
      return;
    }

    throw new ForbiddenException('Material ownership required');
  }
}
