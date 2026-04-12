export const REDIS_PUBLISHER = 'REDIS_PUBLISHER';
export const REDIS_SUBSCRIBER = 'REDIS_SUBSCRIBER';
export const REDIS_CACHE = 'REDIS_CACHE';

export const CHAT_EVENTS_CHANNEL = 'messaging:chat:events';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  instanceId: string;
}
