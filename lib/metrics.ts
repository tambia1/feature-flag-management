import client from "prom-client";

/** Prometheus metrics, scraped from /api/metrics. One registry per process (kept across hot reloads). */
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
  evaluateDuration: metric(
    "sdk_evaluate_duration_seconds",
    () =>
      new client.Histogram({
        name: "sdk_evaluate_duration_seconds",
        help: "SDK evaluate latency",
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
