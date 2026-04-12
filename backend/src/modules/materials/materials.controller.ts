import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CreateMaterialDto } from './dto/create-material.dto';
import { MaterialsService } from './materials.service';

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  findAll(): Promise<void> {
    return this.materialsService.findAll();
  }

  @Get(':materialId')
  findById(@Param('materialId') materialId: string): Promise<void> {
    return this.materialsService.findById(materialId);
  }

  @Post()
  create(@Body() dto: CreateMaterialDto): Promise<void> {
    return this.materialsService.create(dto);
  }
}
