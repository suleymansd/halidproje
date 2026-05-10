import { Injectable, NotFoundException } from '@nestjs/common';

import { CoursesRepository } from './courses.repository';

@Injectable()
export class CoursesService {
  constructor(private readonly coursesRepository: CoursesRepository) {}

  async findAll(): Promise<unknown[]> {
    return this.coursesRepository.findAll();
  }

  async findById(courseId: string): Promise<unknown> {
    const course = await this.coursesRepository.findById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }
}
