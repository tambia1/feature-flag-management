import { randomUUID } from "node:crypto";
import os from "node:os";
import type { ServerStatus } from "@/app/types";
import { logger } from "./logger";
import { openStreamsByEnvironment } from "./flags/streams";
import { getRedis } from "./redis";

const REPORT_INTERVAL_MS = 9_000;
export const PAGE_REFRESH_MS = 30_000;
const SERVERS_KEY = "status:servers";
const SILENT_AFTER_MS = 3 * REPORT_INTERVAL_MS;
const FORGET_AFTER_MS = 5 * 60_000;

type Reporter = {
  latest: ServerStatus;
};

export type ReportedServer = ServerStatus & { isSilent: boolean; isThisServer: boolean };

const globalForStatus = globalThis as unknown as { serverStatusReporter?: Reporter };

async function report(reporter: Reporter): Promise<void> {
  reporter.latest = { ...reporter.latest, reportedAt: Date.now(), streams: openStreamsByEnvironment() };

  const redis = getRedis("status");

  if (redis?.status === "ready") {
    await redis.hset(SERVERS_KEY, reporter.latest.id, JSON.stringify(reporter.latest));
  }
}

export function startServerStatus(): Reporter {
  if (globalForStatus.serverStatusReporter) {
    return globalForStatus.serverStatusReporter;
  }

  const id = `${os.hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
  const reporter: Reporter = {
    latest: {
      id,
      host: os.hostname(),
      pid: process.pid,
      startedAt: Date.now() - Math.round(process.uptime() * 1000),
      reportedAt: Date.now(),
      streams: {},
    },
  };
  globalForStatus.serverStatusReporter = reporter;

  const run = () => report(reporter).catch((err) => logger.warn({ err }, "Server status report failed"));
  void run();
  setInterval(run, REPORT_INTERVAL_MS).unref();

  return reporter;
}

export async function getReportedServers(): Promise<ReportedServer[]> {
  const reporter = startServerStatus();
  const now = Date.now();
  const thisServer: ReportedServer = {
    ...reporter.latest,
    reportedAt: now,
    streams: openStreamsByEnvironment(),
    isSilent: false,
    isThisServer: true,
  };
  const redis = getRedis("status");

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
    if (id === thisServer.id) {
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
