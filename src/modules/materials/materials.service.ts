import { Injectable } from '@nestjs/common';

import { CreateMaterialDto } from './dto/create-material.dto';
import { MaterialsRepository } from './materials.repository';

@Injectable()
export class MaterialsService {
  constructor(private readonly materialsRepository: MaterialsRepository) {}

  async findAll(): Promise<void> {
    void this.materialsRepository;
  }

  async findById(_materialId: string): Promise<void> {
    void this.materialsRepository;
  }

  async create(_dto: CreateMaterialDto): Promise<void> {
    void this.materialsRepository;
  }
}
