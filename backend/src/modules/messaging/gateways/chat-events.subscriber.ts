import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import {
  CHAT_EVENTS_CHANNEL,
  RedisConfig,
} from '../../../infrastructure/redis/redis.constants';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { getRedisConfig } from '../../../infrastructure/config/redis.config';
import { RoomBroadcastService } from './room-broadcast.service';
import { DistributedChatEvent } from './distributed-chat-event.interface';

@Injectable()
export class ChatEventsSubscriber implements OnModuleInit {
  private readonly logger = new Logger(ChatEventsSubscriber.name);
  private readonly redisConfig: RedisConfig = getRedisConfig();

  constructor(
    private readonly redisService: RedisService,
    private readonly roomBroadcastService: RoomBroadcastService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.redisService.subscribe(
      CHAT_EVENTS_CHANNEL,
      async (message: string) => {
        await this.handleMessage(message);
      },
    );
  }

  private async handleMessage(message: string): Promise<void> {
    const event = JSON.parse(message) as DistributedChatEvent;

    if (event.sourceInstanceId === this.redisConfig.instanceId) {
      return;
    }

    this.logger.debug(`Received distributed chat event: ${event.eventName}`);
    this.roomBroadcastService.handleDistributedEvent(event);
  }
}
