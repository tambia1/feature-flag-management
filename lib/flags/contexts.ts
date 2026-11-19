import "server-only";
import type { EvaluationContext, EvaluationResult } from "@/app/types";
import { logger } from "../logger";
import { prisma } from "../prisma";

const WRITE_EVERY_MS = 60_000;
const MAX_REMEMBERED = 10_000;
const KEEP_FOR_DAYS = 30;
const CLEANUP_EVERY_MS = 60 * 60_000;

type LastWrite = { signature: string; at: number };
const globalForContexts = globalThis as unknown as { contextWrites?: Map<string, LastWrite>; contextCleanupStarted?: boolean };
const lastWrites = (globalForContexts.contextWrites ??= new Map());

async function deleteStaleContexts(now = Date.now()): Promise<number> {
  const cutoff = new Date(now - KEEP_FOR_DAYS * 24 * 60 * 60_000);
  const { count } = await prisma.context.deleteMany({ where: { lastSeenAt: { lt: cutoff } } });
  return count;
}

export function startContextCleanup(): void {
  if (globalForContexts.contextCleanupStarted) {
    return;
  }

  globalForContexts.contextCleanupStarted = true;

  const run = () =>
    deleteStaleContexts()
      .then((count) => count > 0 && logger.info({ count }, `Deleted contexts not seen for ${KEEP_FOR_DAYS} days`))
      .catch((err) => logger.warn({ err }, "Could not delete stale contexts"));

  void run();
  setInterval(run, CLEANUP_EVERY_MS).unref();
}

export function recordContext(
  environmentId: string,
  application: string,
  context: EvaluationContext,
  results: Record<string, EvaluationResult>,
): void {
  const id = `${environmentId}|${application}|${context.key}`;
  const signature = JSON.stringify([context, results]);
  const now = Date.now();
  const last = lastWrites.get(id);

  if (last && last.signature === signature && now - last.at < WRITE_EVERY_MS) {
    return;
  }

  if (lastWrites.size >= MAX_REMEMBERED) {
    lastWrites.clear();
  }

  lastWrites.set(id, { signature, at: now });

  const { key, ...attributes } = context;
  const data = { attributes: attributes as object, results: results as object, lastSeenAt: new Date(now) };
  const fail = (err: unknown) => {
    lastWrites.delete(id);
    logger.warn({ err }, "Could not record SDK context");
  };

  try {
    prisma.context
      .upsert({
        where: { environmentId_application_key: { environmentId, application, key } },
        create: { environmentId, application, key, ...data },
        update: data,
        select: { id: true },
      })
      .catch(fail);
  } catch (err) {
    fail(err);
  }
}
