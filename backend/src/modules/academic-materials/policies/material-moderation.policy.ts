import { ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class MaterialModerationPolicy {
  isModerator(roles: string[]): boolean {
    return (
      roles.includes('super_admin') ||
      roles.includes('moderator') ||
      roles.includes('school_admin')
    );
  }

  assertCanRemoveMaterial(
    user: { id: string; roles: string[] },
    ownerId: string,
  ): void {
    if (user.id === ownerId || this.isModerator(user.roles)) {
      return;
    }

    throw new ForbiddenException('Material removal is not allowed');
  }
}
