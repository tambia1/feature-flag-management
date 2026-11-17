import "server-only";
import { EventEmitter } from "node:events";
import type Redis from "ioredis";
import { logger } from "./logger";
import { getRedis } from "./redis";

const CHANNEL = "flag-changed";

type PubSub = {
  local: EventEmitter;
  publisher?: Redis;
};

function createPubSub(): PubSub {
  const local = new EventEmitter();
  local.setMaxListeners(0);

  const publisher = getRedis();

  if (!publisher) {
    return { local };
  }

  const subscriber = publisher.duplicate({ enableOfflineQueue: true, commandTimeout: undefined });
  subscriber.on("error", (err) => logger.warn({ err }, "Redis connection error"));

  subscriber.subscribe(CHANNEL).catch((err) => logger.error({ err }, "Redis subscribe failed"));
  subscriber.on("message", (_channel, environmentId: string) => local.emit(CHANNEL, environmentId));

  return { local, publisher };
}

const globalForPubSub = globalThis as unknown as { pubsub?: PubSub };
const pubsub = (globalForPubSub.pubsub ??= createPubSub());

export async function publishFlagChange(environmentIds: string[]): Promise<void> {
  for (const environmentId of new Set(environmentIds)) {
    if (pubsub.publisher) {
      try {
        await pubsub.publisher.publish(CHANNEL, environmentId);
        continue;
      } catch (err) {
        logger.error({ err }, "Redis publish failed, notifying this server only");
      }
    }

    pubsub.local.emit(CHANNEL, environmentId);
  }
}

export function onFlagChange(listener: (environmentId: string) => void): () => void {
  pubsub.local.on(CHANNEL, listener);
  return () => pubsub.local.off(CHANNEL, listener);
}
