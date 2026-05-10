import { ForbiddenException, Injectable } from '@nestjs/common';

import { AuditRepository } from './audit.repository';

interface AuditUserContext {
  id: string;
  schoolId: string;
  roles: string[];
}

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async findAll(user: AuditUserContext, limit?: number) {
    this.assertAdmin(user.roles);
    return this.auditRepository.findAll(user.schoolId, limit);
  }

  async getAdminToolsOverview(user: AuditUserContext) {
    this.assertAdmin(user.roles);
    return this.auditRepository.getAdminToolsOverview(user.schoolId);
  }

  private assertAdmin(roles: string[]) {
    if (!roles.includes('school_admin') && !roles.includes('moderator')) {
      throw new ForbiddenException('Admin access required');
    }
  }
}
