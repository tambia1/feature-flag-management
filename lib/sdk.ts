import "server-only";
import { sdkMetrics } from "./metrics";

export function readSdkKey(request: Request): string | null {
  const header = request.headers.get("authorization")?.trim();

  if (!header) {
    return null;
  }

  return header.replace(/^Bearer\s+/i, "") || null;
}

const RATE = 200;
const BURST = 1000;

type Bucket = { tokens: number; updatedAt: number };
const globalForLimits = globalThis as unknown as { sdkBuckets?: Map<string, Bucket> };
const buckets = (globalForLimits.sdkBuckets ??= new Map());

export function takeRateLimitToken(sdkKey: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(sdkKey) ?? { tokens: BURST, updatedAt: now };

  bucket.tokens = Math.min(BURST, bucket.tokens + ((now - bucket.updatedAt) / 1000) * RATE);
  bucket.updatedAt = now;

  if (bucket.tokens < 1) {
    buckets.set(sdkKey, bucket);
    sdkMetrics.rateLimited.inc();
    return false;
  }

  bucket.tokens -= 1;
  buckets.set(sdkKey, bucket);
  return true;
}

export const SDK_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};
