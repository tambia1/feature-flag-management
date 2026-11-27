import Redis from "ioredis";
import { logger } from "./logger";

type RedisRole = "flags" | "status";

const URL_SETTINGS: Record<RedisRole, string> = {
  flags: "FLAGS_REDIS_URL",
  status: "STATUS_REDIS_URL",
};

const globalForRedis = globalThis as unknown as { redis?: Partial<Record<RedisRole, Redis | null>> };
const clients = (globalForRedis.redis ??= {});

function createRedis(role: RedisRole): Redis | null {
  const url = process.env[URL_SETTINGS[role]];

  if (!url) {
    return null;
  }

  const client = new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: false, commandTimeout: 1000 });
  client.on("error", (err) => logger.warn({ err, redis: role }, "Redis connection error"));
  return client;
}

export function getRedis(role: RedisRole): Redis | null {
  if (clients[role] === undefined) {
    clients[role] = createRedis(role);
  }

  return clients[role];
}
