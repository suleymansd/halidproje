import { Injectable } from '@nestjs/common';

import { DepartmentsRepository } from './departments.repository';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly departmentsRepository: DepartmentsRepository,
  ) {}

  async findAll(): Promise<unknown[]> {
    return this.departmentsRepository.findAll();
  }

  async findById(departmentId: string): Promise<unknown> {
    return this.departmentsRepository.findById(departmentId);
  }
}
