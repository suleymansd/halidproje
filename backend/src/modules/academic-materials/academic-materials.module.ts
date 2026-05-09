import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { MessagingModule } from '../messaging/messaging.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AcademicMaterialsController } from './academic-materials.controller';
import { AcademicMaterialsRepository } from './academic-materials.repository';
import { AcademicMaterialsService } from './academic-materials.service';
import { MaterialAccessPolicy } from './policies/material-access.policy';
import { MaterialModerationPolicy } from './policies/material-moderation.policy';

@Module({
  imports: [SharedModule, NotificationsModule, MessagingModule],
  controllers: [AcademicMaterialsController],
  providers: [
    AcademicMaterialsService,
    AcademicMaterialsRepository,
    MaterialAccessPolicy,
    MaterialModerationPolicy,
  ],
  exports: [AcademicMaterialsService],
})
export class AcademicMaterialsModule {}
