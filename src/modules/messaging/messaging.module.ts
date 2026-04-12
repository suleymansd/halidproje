import { Module } from '@nestjs/common';

import { RedisModule } from '../../infrastructure/redis/redis.module';
import { SharedModule } from '../../shared/shared.module';
import { ChatEventsPublisher } from './gateways/chat-events.publisher';
import { ChatEventsSubscriber } from './gateways/chat-events.subscriber';
import { ChatGateway } from './gateways/chat.gateway';
import { ChatGatewayAdapter } from './gateways/chat.gateway.adapter';
import { RoomBroadcastService } from './gateways/room-broadcast.service';
import { SocketSessionService } from './gateways/socket-session.service';
import { MessagingController } from './messaging.controller';
import { MessagingRepository } from './messaging.repository';
import { MessagingService } from './messaging.service';
import { ChatAccessPolicy } from './policies/chat-access.policy';
import { ChatRoomTypePolicy } from './policies/chat-room-type.policy';

@Module({
  imports: [SharedModule, RedisModule],
  controllers: [MessagingController],
  providers: [
    MessagingService,
    MessagingRepository,
    ChatAccessPolicy,
    ChatRoomTypePolicy,
    ChatGatewayAdapter,
    SocketSessionService,
    RoomBroadcastService,
    ChatEventsPublisher,
    ChatEventsSubscriber,
    ChatGateway,
  ],
  exports: [MessagingService],
})
export class MessagingModule {}
