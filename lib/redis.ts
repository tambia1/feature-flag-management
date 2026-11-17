import Redis from "ioredis";
import { logger } from "./logger";

const globalForRedis = globalThis as unknown as { redis?: Redis | null };

function createRedis(): Redis | null {
  const url = process.env.REDIS_URL;

  if (!url) {
    return null;
  }

  const client = new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: false, commandTimeout: 1000 });
  client.on("error", (err) => logger.warn({ err }, "Redis connection error"));
  return client;
}

export function getRedis(): Redis | null {
  if (globalForRedis.redis === undefined) {
    globalForRedis.redis = createRedis();
  }

  return globalForRedis.redis;
}
