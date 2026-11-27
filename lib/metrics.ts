import client from "prom-client";
import { iconQueueDepth } from "./icon-queue";
import { logger } from "./logger";

const globalForMetrics = globalThis as unknown as { metricsRegistry?: client.Registry };

export const registry =
  globalForMetrics.metricsRegistry ??
  (() => {
    const created = new client.Registry();
    client.collectDefaultMetrics({ register: created });
    return created;
  })();

globalForMetrics.metricsRegistry = registry;

function metric<T extends client.Metric>(name: string, create: () => T): T {
  return (registry.getSingleMetric(name) as T | undefined) ?? create();
}

export const sdkMetrics = {
  flagsDuration: metric(
    "sdk_flags_duration_seconds",
    () =>
      new client.Histogram({
        name: "sdk_flags_duration_seconds",
        help: "SDK flags request latency",
        labelNames: ["status"],
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
        registers: [registry],
      }),
  ),
  cacheHits: metric(
    "sdk_flag_cache_hits_total",
    () => new client.Counter({ name: "sdk_flag_cache_hits_total", help: "Flag cache hits", registers: [registry] }),
  ),
  cacheMisses: metric(
    "sdk_flag_cache_misses_total",
    () => new client.Counter({ name: "sdk_flag_cache_misses_total", help: "Flag cache misses", registers: [registry] }),
  ),
  openStreams: metric(
    "sdk_open_streams",
    () => new client.Gauge({ name: "sdk_open_streams", help: "Open SDK stream connections", registers: [registry] }),
  ),
  rateLimited: metric(
    "sdk_rate_limited_total",
    () => new client.Counter({ name: "sdk_rate_limited_total", help: "SDK requests rejected by the rate limit", registers: [registry] }),
  ),
};

metric(
  "icon_queue_messages",
  () =>
    new client.Gauge({
      name: "icon_queue_messages",
      help: "Messages in the icon queue, waiting or being worked on",
      labelNames: ["state"],
      registers: [registry],
      async collect() {
        try {
          const depth = await iconQueueDepth();
          this.set({ state: "waiting" }, depth.waiting);
          this.set({ state: "in_flight" }, depth.inFlight);
        } catch (error) {
          this.reset();
          logger.warn({ error }, "Couldn't read the icon queue depth");
        }
      },
    }),
);
