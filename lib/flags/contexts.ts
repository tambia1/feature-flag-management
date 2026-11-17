import "server-only";
import type { EvaluationContext, EvaluationResult } from "@/app/types";
import { logger } from "../logger";
import { prisma } from "../prisma";

const WRITE_EVERY_MS = 60_000;
const MAX_REMEMBERED = 10_000;

type LastWrite = { signature: string; at: number };
const globalForContexts = globalThis as unknown as { contextWrites?: Map<string, LastWrite> };
const lastWrites = (globalForContexts.contextWrites ??= new Map());

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
