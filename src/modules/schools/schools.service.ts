import { Injectable } from '@nestjs/common';

import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolsRepository } from './schools.repository';

@Injectable()
export class SchoolsService {
  constructor(private readonly schoolsRepository: SchoolsRepository) {}

  async findAll(): Promise<void> {
    void this.schoolsRepository;
  }

  async findById(_schoolId: string): Promise<void> {
    void this.schoolsRepository;
  }

  async update(_schoolId: string, _dto: UpdateSchoolDto): Promise<void> {
    void this.schoolsRepository;
  }
}
