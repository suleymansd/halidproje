import { ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class ModeratorRolePolicy {
  isModerator(roles: string[]): boolean {
    return roles.includes('moderator') || roles.includes('school_admin');
  }

  assertModerator(roles: string[]): void {
    if (!this.isModerator(roles)) {
      throw new ForbiddenException('Moderator role required');
    }
  }
}
