import { Controller, Get } from '@nestjs/common';

import { AuditService } from './audit.service';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(): Promise<void> {
    return this.auditService.findAll();
  }
}
