import { createClient } from 'redis';
import { logger } from './logger.js';

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connectPromise: Promise<RedisClient> | null = null;

function getRedisUrl(): string {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    throw new Error('REDIS_URL is not configured.');
  }
  return url;
}

export async function getRedisClient(): Promise<RedisClient> {
  if (client?.isOpen) {
    return client;
  }

  if (!connectPromise) {
    const next = createClient({ url: getRedisUrl() });
    next.on('error', (error) => {
      logger.error({ err: error }, 'Redis client error');
    });
    connectPromise = next.connect().then(() => {
      client = next;
      return next;
    });
  }

  return connectPromise;
}

export async function closeRedisClient(): Promise<void> {
  connectPromise = null;
  if (client?.isOpen) {
    await client.quit();
  }
  client = null;
}

/** @internal Test hook */
export function resetRedisClientForTests(): void {
  client = null;
  connectPromise = null;
}
