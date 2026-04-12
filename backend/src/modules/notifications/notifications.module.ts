import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';
import { NotificationAccessPolicy } from './policies/notification-access.policy';

@Module({
  imports: [SharedModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationAccessPolicy,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
