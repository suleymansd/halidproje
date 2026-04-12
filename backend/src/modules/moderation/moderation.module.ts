import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { ModerationController } from './moderation.controller';
import { ModerationRepository } from './moderation.repository';
import { ModerationService } from './moderation.service';
import { ModerationAccessPolicy } from './policies/moderation-access.policy';
import { ModeratorRolePolicy } from './policies/moderator-role.policy';

@Module({
  imports: [SharedModule],
  controllers: [ModerationController],
  providers: [
    ModerationService,
    ModerationRepository,
    ModerationAccessPolicy,
    ModeratorRolePolicy,
  ],
  exports: [ModerationService],
})
export class ModerationModule {}
