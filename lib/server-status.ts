import { randomUUID } from "node:crypto";
import os from "node:os";
import { monitorEventLoopDelay, type ELDHistogram } from "node:perf_hooks";
import type { ServerStatus } from "@/app/types";
import { logger } from "./logger";
import { sdkMetrics } from "./metrics";
import { getRedis } from "./redis";

export const SAMPLE_INTERVAL_MS = 9_000;
export const STATUS_WINDOW_MINUTES = 5;
const WINDOW_MS = STATUS_WINDOW_MINUTES * 60_000;
const SERVERS_KEY = "status:servers";
const SILENT_AFTER_MS = 3 * SAMPLE_INTERVAL_MS;
const FORGET_AFTER_MS = WINDOW_MS;

type Sample = {
  at: number;
  requests: number;
  latencySeconds: number;
  errors: number;
  rateLimited: number;
};

type Sampler = {
  id: string;
  host: string;
  startedAt: number;
  samples: Sample[];
  eventLoop: ELDHistogram;
  latest: ServerStatus;
};

export type ReportedServer = ServerStatus & { isSilent: boolean; isThisServer: boolean };

const globalForStatus = globalThis as unknown as { serverStatusSampler?: Sampler };

async function readSample(): Promise<Sample> {
  const [evaluate, rateLimited] = await Promise.all([sdkMetrics.evaluateDuration.get(), sdkMetrics.rateLimited.get()]);
  const sample: Sample = { at: Date.now(), requests: 0, latencySeconds: 0, errors: 0, rateLimited: 0 };

  for (const value of evaluate.values) {
    if (value.metricName === "sdk_evaluate_duration_seconds_count") {
      sample.requests += value.value;

      if (String(value.labels.status).startsWith("5")) {
        sample.errors += value.value;
      }
    } else if (value.metricName === "sdk_evaluate_duration_seconds_sum") {
      sample.latencySeconds += value.value;
    }
  }

  sample.rateLimited = rateLimited.values.reduce((total, value) => total + value.value, 0);
  return sample;
}

async function buildStatus(sampler: Sampler): Promise<ServerStatus> {
  const oldest = sampler.samples[0];
  const newest = sampler.samples[sampler.samples.length - 1];
  const seconds = (newest.at - oldest.at) / 1000;
  const requests = newest.requests - oldest.requests;
  const openStreams = (await sdkMetrics.openStreams.get()).values[0]?.value ?? 0;
  const eventLoopDelayMs = sampler.eventLoop.percentile(99) / 1e6;
  sampler.eventLoop.reset();

  return {
    id: sampler.id,
    host: sampler.host,
    pid: process.pid,
    startedAt: sampler.startedAt,
    reportedAt: newest.at,
    openStreams,
    requestsPerSecond: seconds > 0 ? requests / seconds : 0,
    averageResponseMs: requests > 0 ? ((newest.latencySeconds - oldest.latencySeconds) / requests) * 1000 : null,
    errors: newest.errors - oldest.errors,
    rateLimited: newest.rateLimited - oldest.rateLimited,
    memoryMb: process.memoryUsage().rss / 1024 / 1024,
    eventLoopDelayMs: Number.isFinite(eventLoopDelayMs) ? eventLoopDelayMs : 0,
  };
}

async function tick(sampler: Sampler): Promise<void> {
  const sample = await readSample();
  sampler.samples.push(sample);

  while (sampler.samples.length > 1 && sampler.samples[1].at <= sample.at - WINDOW_MS) {
    sampler.samples.shift();
  }

  sampler.latest = await buildStatus(sampler);

  const redis = getRedis();

  if (redis) {
    await redis.hset(SERVERS_KEY, sampler.id, JSON.stringify(sampler.latest));
  }
}

export function startServerStatus(): Sampler {
  if (globalForStatus.serverStatusSampler) {
    return globalForStatus.serverStatusSampler;
  }

  const startedAt = Date.now() - Math.round(process.uptime() * 1000);
  const eventLoop = monitorEventLoopDelay({ resolution: 20 });
  eventLoop.enable();

  const id = `${os.hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
  const sampler: Sampler = {
    id,
    host: os.hostname(),
    startedAt,
    samples: [],
    eventLoop,
    latest: {
      id,
      host: os.hostname(),
      pid: process.pid,
      startedAt,
      reportedAt: Date.now(),
      openStreams: 0,
      requestsPerSecond: 0,
      averageResponseMs: null,
      errors: 0,
      rateLimited: 0,
      memoryMb: process.memoryUsage().rss / 1024 / 1024,
      eventLoopDelayMs: 0,
    },
  };
  globalForStatus.serverStatusSampler = sampler;

  const run = () => tick(sampler).catch((err) => logger.warn({ err }, "Server status sample failed"));
  void run();
  setInterval(run, SAMPLE_INTERVAL_MS).unref();

  return sampler;
}

export async function getReportedServers(): Promise<ReportedServer[]> {
  const sampler = startServerStatus();
  const now = Date.now();
  const thisServer: ReportedServer = { ...sampler.latest, isSilent: false, isThisServer: true };
  const redis = getRedis();

  if (!redis) {
    return [thisServer];
  }

  const stored = await redis.hgetall(SERVERS_KEY).catch((err) => {
    logger.warn({ err }, "Could not read other servers from Redis");
    return {};
  });
  const others: ReportedServer[] = [];
  const forgotten: string[] = [];

  for (const [id, json] of Object.entries(stored)) {
    if (id === sampler.id) {
      continue;
    }

    const status = JSON.parse(json) as ServerStatus;
    const age = now - status.reportedAt;

    if (age > FORGET_AFTER_MS) {
      forgotten.push(id);
    } else {
      others.push({ ...status, isSilent: age > SILENT_AFTER_MS, isThisServer: false });
    }
  }

  if (forgotten.length > 0) {
    await redis.hdel(SERVERS_KEY, ...forgotten).catch(() => 0);
  }

  return [thisServer, ...others.sort((a, b) => a.startedAt - b.startedAt)];
}
