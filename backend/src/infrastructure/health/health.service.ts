import { Inject, Injectable } from '@nestjs/common';
import { Client } from 'pg';
import Redis from 'ioredis';

import { REDIS_CACHE } from '../redis/redis.constants';

@Injectable()
export class HealthService {
  constructor(@Inject(REDIS_CACHE) private readonly redisClient: Redis) {}

  async check(): Promise<{
    status: 'ok' | 'degraded';
    uptimeSeconds: number;
    services: {
      database: 'ok' | 'degraded';
      redis: 'ok' | 'degraded';
    };
  }> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    return {
      status: database === 'ok' && redis === 'ok' ? 'ok' : 'degraded',
      uptimeSeconds: process.uptime(),
      services: {
        database,
        redis,
      },
    };
  }

  private async checkDatabase(): Promise<'ok' | 'degraded'> {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });

    try {
      await client.connect();
      await client.query('SELECT 1');
      return 'ok';
    } catch {
      return 'degraded';
    } finally {
      await client.end().catch(() => undefined);
    }
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
