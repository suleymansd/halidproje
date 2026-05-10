import { Controller, Get, Param } from '@nestjs/common';

import { CoursesService } from './courses.service';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  findAll(): Promise<unknown[]> {
    return this.coursesService.findAll();
  }

  @Get(':courseId')
  findById(@Param('courseId') courseId: string): Promise<unknown> {
    return this.coursesService.findById(courseId);
  }
}
