import { Controller, Get, Param } from '@nestjs/common';

import { DepartmentsService } from './departments.service';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll(): Promise<unknown[]> {
    return this.departmentsService.findAll();
  }

  @Get(':departmentId')
  findById(@Param('departmentId') departmentId: string): Promise<unknown> {
    return this.departmentsService.findById(departmentId);
  }
}
