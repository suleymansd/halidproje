import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

import { REDIS_CACHE } from '../redis/redis.constants';

@Injectable()
export class HealthService {
  constructor(@Inject(REDIS_CACHE) private readonly redisClient: Redis) {}

  async check(): Promise<{
    status: 'ok' | 'degraded';
    uptimeSeconds: number;
    services: {
      database: 'unknown' | 'ok' | 'degraded';
      redis: 'ok' | 'degraded';
    };
  }> {
    return {
      status: (await this.checkRedis()) === 'ok' ? 'ok' : 'degraded',
      uptimeSeconds: process.uptime(),
      services: {
        database: 'unknown',
        redis: await this.checkRedis(),
      },
    };
  }

  private async checkRedis(): Promise<'ok' | 'degraded'> {
    try {
      const pong = await this.redisClient.ping();
      return pong === 'PONG' ? 'ok' : 'degraded';
    } catch {
      return 'degraded';
    }
  }
}
