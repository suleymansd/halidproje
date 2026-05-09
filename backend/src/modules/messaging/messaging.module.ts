import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { RedisModule } from '../../infrastructure/redis/redis.module';
import { SharedModule } from '../../shared/shared.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatEventsPublisher } from './gateways/chat-events.publisher';
import { ChatEventsSubscriber } from './gateways/chat-events.subscriber';
import { ChatGateway } from './gateways/chat.gateway';
import { ChatGatewayAdapter } from './gateways/chat.gateway.adapter';
import { RoomBroadcastService } from './gateways/room-broadcast.service';
import { SocketSessionService } from './gateways/socket-session.service';
import { PresenceService } from './gateways/presence.service';
import { MessagingController } from './messaging.controller';
import { MessagingRepository } from './messaging.repository';
import { MessagingService } from './messaging.service';
import { ChatAccessPolicy } from './policies/chat-access.policy';
import { ChatRoomTypePolicy } from './policies/chat-room-type.policy';

@Module({
  imports: [SharedModule, RedisModule, NotificationsModule, JwtModule.register({})],
  controllers: [MessagingController],
  providers: [
    MessagingService,
    MessagingRepository,
    ChatAccessPolicy,
    ChatRoomTypePolicy,
    ChatGatewayAdapter,
    SocketSessionService,
    RoomBroadcastService,
    PresenceService,
    ChatEventsPublisher,
    ChatEventsSubscriber,
    ChatGateway,
  ],
  exports: [
    MessagingService,
    PresenceService,
    RoomBroadcastService,
    ChatEventsPublisher,
  ],
})
export class MessagingModule {}
