import { Module } from '@nestjs/common';

import { SchoolsController } from './schools.controller';
import { SchoolsRepository } from './schools.repository';
import { SchoolsService } from './schools.service';

@Module({
  controllers: [SchoolsController],
  providers: [SchoolsService, SchoolsRepository],
  exports: [SchoolsService],
})
export class SchoolsModule {}
