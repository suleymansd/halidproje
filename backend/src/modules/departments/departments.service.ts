import { Injectable } from '@nestjs/common';

import { DepartmentsRepository } from './departments.repository';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly departmentsRepository: DepartmentsRepository,
  ) {}

  async findAll(): Promise<void> {
    void this.departmentsRepository;
  }

  async findById(_departmentId: string): Promise<void> {
    void this.departmentsRepository;
  }
}
