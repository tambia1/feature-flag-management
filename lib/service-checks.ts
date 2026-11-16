import "server-only";
import type { ServiceCheck } from "@/app/types";
import { prisma } from "./prisma";
import { getRedis } from "./redis";

const TIMEOUT_MS = 2000;

async function timed(name: string, check: () => Promise<unknown>): Promise<ServiceCheck> {
  const started = performance.now();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`No answer within ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS);
  });

  try {
    await Promise.race([check(), timeout]);
    return { name, state: "up", detail: `Answered in ${Math.round(performance.now() - started)} ms` };
  } catch (err) {
    return { name, state: "down", detail: err instanceof Error ? err.message : "Not reachable" };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkServices(): Promise<ServiceCheck[]> {
  const redis = getRedis();

  return Promise.all([
    timed("Postgres", () => prisma.$queryRaw`SELECT 1`),
    redis
      ? timed("Redis", () => redis.ping())
      : Promise.resolve<ServiceCheck>({ name: "Redis", state: "off", detail: "REDIS_URL is not set (fine with one server)" }),
  ]);
}
