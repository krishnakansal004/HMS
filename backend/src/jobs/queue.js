import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Explicitly handle Upstash TLS requirements
const redisOptions = {
  maxRetriesPerRequest: null,
};

if (redisUrl.startsWith('rediss://')) {
  redisOptions.tls = { rejectUnauthorized: false };
}

export const redisConnection = new IORedis(redisUrl, redisOptions);

redisConnection.on('error', (err) => console.error('[Redis Error]', err.message));
redisConnection.on('ready', () => console.log('[Redis] Connected to Upstash successfully'));

export const notificationQueue = new Queue('notifications', { 
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 100
  }
});