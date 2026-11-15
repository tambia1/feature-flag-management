import "server-only";
import { EventEmitter } from "node:events";
import Redis from "ioredis";
import { logger } from "./logger";

const CHANNEL = "flag-changed";

type PubSub = {
  local: EventEmitter;
  publisher?: Redis;
};

function createPubSub(): PubSub {
  const local = new EventEmitter();
  local.setMaxListeners(0);

  const url = process.env.REDIS_URL;

  if (!url) {
    return { local };
  }

  const publisher = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
  const subscriber = new Redis(url);

  for (const client of [publisher, subscriber]) {
    client.on("error", (err) => logger.warn({ err }, "Redis connection error"));
  }

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
