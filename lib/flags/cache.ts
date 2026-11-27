import "server-only";
import type { FlagConfig, JsonValue, Rule } from "@/app/types";
import { prisma } from "../prisma";
import { onFlagChange } from "../pubsub";
import { sdkMetrics } from "../metrics";

type EnvironmentFlags = {
  environmentId: string;
  flags: FlagConfig[];
  loadedAt: number;
};

const MAX_AGE_MS = 60_000;

type Cache = { bySdkKey: Map<string, EnvironmentFlags>; subscribed: boolean };
const globalForCache = globalThis as unknown as { flagCache?: Cache };
const cache = (globalForCache.flagCache ??= { bySdkKey: new Map(), subscribed: false });

if (!cache.subscribed) {
  cache.subscribed = true;
  onFlagChange((environmentId) => {
    for (const [sdkKey, entry] of cache.bySdkKey) {
      if (entry.environmentId === environmentId) {
        cache.bySdkKey.delete(sdkKey);
      }
    }
  });
}

export async function getFlagsForSdkKey(sdkKey: string): Promise<EnvironmentFlags | null> {
  const cached = cache.bySdkKey.get(sdkKey);

  if (cached && Date.now() - cached.loadedAt < MAX_AGE_MS) {
    sdkMetrics.cacheHits.inc();
    return cached;
  }

  sdkMetrics.cacheMisses.inc();

  const environment = await prisma.environment.findUnique({
    where: { sdkKey },
    select: { id: true },
  });

  if (!environment) {
    return null;
  }

  const entry: EnvironmentFlags = {
    environmentId: environment.id,
    flags: await loadFlagConfigs(environment.id),
    loadedAt: Date.now(),
  };

  cache.bySdkKey.set(sdkKey, entry);
  return entry;
}

export async function loadFlagConfigs(environmentId: string): Promise<FlagConfig[]> {
  const rows = await prisma.flagEnvironment.findMany({
    where: { environmentId },
    select: {
      isOn: true,
      offVariationId: true,
      rules: true,
      flag: {
        select: {
          key: true,
          archivedAt: true,
          variations: { select: { id: true, value: true, order: true }, orderBy: { order: "asc" } },
        },
      },
    },
  });

  return rows.map((row) => ({
    key: row.flag.key,
    archived: row.flag.archivedAt !== null,
    isOn: row.isOn,
    offVariationId: row.offVariationId,
    variations: row.flag.variations.map((variation) => ({ ...variation, value: variation.value as JsonValue })),
    rules: row.rules as Rule[],
  }));
}
