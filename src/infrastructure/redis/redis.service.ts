import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import {
  REDIS_CACHE,
  REDIS_PUBLISHER,
  REDIS_SUBSCRIBER,
} from './redis.constants';

type RedisMessageHandler = (message: string, channel: string) => Promise<void> | void;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly messageHandlers = new Map<string, Set<RedisMessageHandler>>();

  constructor(
    @Inject(REDIS_PUBLISHER) private readonly publisher: Redis,
    @Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis,
    @Inject(REDIS_CACHE) private readonly cache: Redis,
  ) {
    this.subscriber.on('message', (channel, message) => {
      void this.handleMessage(channel, message);
    });
  }

  async publish(channel: string, payload: string): Promise<number> {
    return this.publisher.publish(channel, payload);
  }

  async subscribe(channel: string, handler: RedisMessageHandler): Promise<void> {
    const handlers = this.messageHandlers.get(channel) ?? new Set<RedisMessageHandler>();
    handlers.add(handler);
    this.messageHandlers.set(channel, handlers);

    if (handlers.size === 1) {
      await this.subscriber.subscribe(channel);
    }
  }

  async unsubscribe(channel: string, handler?: RedisMessageHandler): Promise<void> {
    const handlers = this.messageHandlers.get(channel);
    if (!handlers) {
      return;
    }

    if (handler) {
      handlers.delete(handler);
    } else {
      handlers.clear();
    }

    if (handlers.size === 0) {
      this.messageHandlers.delete(channel);
      await this.subscriber.unsubscribe(channel);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.cache.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.cache.set(key, value, 'EX', ttlSeconds);
      return;
    }

    await this.cache.set(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.cache.del(key);
  }

  async setAdd(key: string, ...members: string[]): Promise<void> {
    if (members.length === 0) {
      return;
    }

    await this.cache.sadd(key, ...members);
  }

  async setRemove(key: string, ...members: string[]): Promise<void> {
    if (members.length === 0) {
      return;
    }

    await this.cache.srem(key, ...members);
  }

  async setMembers(key: string): Promise<string[]> {
    return this.cache.smembers(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.cache.expire(key, ttlSeconds);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.publisher.quit(),
      this.subscriber.quit(),
      this.cache.quit(),
    ]);
  }

  private async handleMessage(channel: string, message: string): Promise<void> {
    const handlers = this.messageHandlers.get(channel);
    if (!handlers || handlers.size === 0) {
      return;
    }

    for (const handler of handlers) {
      try {
        await handler(message, channel);
      } catch (error) {
        this.logger.error(
          `Redis subscriber handler failed for channel ${channel}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
