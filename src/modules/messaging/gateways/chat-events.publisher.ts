import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

import {
  CHAT_EVENTS_CHANNEL,
  RedisConfig,
} from '../../../infrastructure/redis/redis.constants';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { getRedisConfig } from '../../../infrastructure/config/redis.config';
import { DistributedChatEvent } from './distributed-chat-event.interface';

@Injectable()
export class ChatEventsPublisher {
  private readonly redisConfig: RedisConfig = getRedisConfig();

  constructor(private readonly redisService: RedisService) {}

  async publish<TPayload>(
    eventName: string,
    schoolId: string,
    payload: TPayload,
    options?: {
      roomId?: string;
      userId?: string;
      correlationId?: string;
    },
  ): Promise<DistributedChatEvent<TPayload>> {
    const envelope: DistributedChatEvent<TPayload> = {
      eventName,
      schoolId,
      roomId: options?.roomId,
      userId: options?.userId,
      payload,
      emittedAt: new Date().toISOString(),
      correlationId: options?.correlationId ?? randomUUID(),
      sourceInstanceId: this.redisConfig.instanceId,
    };

    await this.redisService.publish(CHAT_EVENTS_CHANNEL, JSON.stringify(envelope));
    return envelope;
  }
}
