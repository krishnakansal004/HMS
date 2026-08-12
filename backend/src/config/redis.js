import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

// maxRetriesPerRequest must be null for BullMQ compatibility
export const redisConnection = new Redis(env.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on('connect', () => {
  logger.info('Redis connected successfully');
});

redisConnection.on('error', (error) => {
  logger.error('Redis connection error', { error });
});