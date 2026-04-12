import { Body, Controller, Get, Param, Patch } from '@nestjs/common';

import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolsService } from './schools.service';

@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Get()
  findAll(): Promise<void> {
    return this.schoolsService.findAll();
  }

  @Get(':schoolId')
  findById(@Param('schoolId') schoolId: string): Promise<void> {
    return this.schoolsService.findById(schoolId);
  }

  @Patch(':schoolId')
  update(
    @Param('schoolId') schoolId: string,
    @Body() dto: UpdateSchoolDto,
  ): Promise<void> {
    return this.schoolsService.update(schoolId, dto);
  }
}
