import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';

import { getRedisConfig } from '../config/redis.config';
import {
  REDIS_CACHE,
  REDIS_PUBLISHER,
  REDIS_SUBSCRIBER,
} from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_PUBLISHER,
      useFactory: (): Redis => {
        const config = getRedisConfig();
        return new Redis({
          host: config.host,
          port: config.port,
          password: config.password,
          db: config.db,
          lazyConnect: true,
          maxRetriesPerRequest: null,
        });
      },
    },
    {
      provide: REDIS_SUBSCRIBER,
      useFactory: (): Redis => {
        const config = getRedisConfig();
        return new Redis({
          host: config.host,
          port: config.port,
          password: config.password,
          db: config.db,
          lazyConnect: true,
          maxRetriesPerRequest: null,
        });
      },
    },
    {
      provide: REDIS_CACHE,
      useFactory: (): Redis => {
        const config = getRedisConfig();
        return new Redis({
          host: config.host,
          port: config.port,
          password: config.password,
          db: config.db,
          lazyConnect: true,
          maxRetriesPerRequest: null,
        });
      },
    },
    RedisService,
  ],
  exports: [RedisService, REDIS_PUBLISHER, REDIS_SUBSCRIBER, REDIS_CACHE],
})
export class RedisModule {}
