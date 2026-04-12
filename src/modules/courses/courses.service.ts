import { Injectable } from '@nestjs/common';

import { CoursesRepository } from './courses.repository';

@Injectable()
export class CoursesService {
  constructor(private readonly coursesRepository: CoursesRepository) {}

  async findAll(): Promise<void> {
    void this.coursesRepository;
  }

  async findById(_courseId: string): Promise<void> {
    void this.coursesRepository;
  }
}
