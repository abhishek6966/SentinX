// =============================================================================
// SentinX — Redis Connection (Upstash)
// Used for: price caching, BullMQ queues, rate limit counters
// =============================================================================
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

let redisClient: Redis;

export function connectRedis(): Promise<void> {
  return new Promise((resolve, reject) => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required');
    }

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
      tls: redisUrl.startsWith('rediss://') ? {} : undefined,
    });

    redisClient.on('connect', () => {
      logger.info('Redis connection established');
      resolve();
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
      reject(err);
    });

    redisClient.connect().catch(reject);
  });
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return redisClient;
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await getRedisClient().get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  await getRedisClient().setex(key, ttlSeconds, JSON.stringify(value));
}

export async function cacheDel(key: string): Promise<void> {
  await getRedisClient().del(key);
}

export async function cacheKeys(pattern: string): Promise<string[]> {
  return getRedisClient().keys(pattern);
}
