import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CurrentUserDecorator } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditService } from './audit.service';

interface AuditUserContext {
  id: string;
  schoolId: string;
  roles: string[];
}

@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(
    @CurrentUserDecorator() user: AuditUserContext,
    @Query('limit') limit?: string,
  ) {
    return this.auditService.findAll(user, limit ? Number(limit) : undefined);
  }

  @Get('admin-tools')
  getAdminToolsOverview(@CurrentUserDecorator() user: AuditUserContext) {
    return this.auditService.getAdminToolsOverview(user);
  }
}
