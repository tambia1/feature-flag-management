import "server-only";
import { PostHog } from "posthog-node";

type AnalyticsEvent =
  | "login"
  | "flag created"
  | "flag toggled"
  | "flag archived"
  | "flag deleted"
  | "user invited"
  | "project created"
  | "company created";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const globalForAnalytics = globalThis as unknown as { posthog?: PostHog | null };
const posthog = (globalForAnalytics.posthog ??= key
  ? new PostHog(key, { host: process.env.NEXT_PUBLIC_POSTHOG_HOST, flushAt: 20, flushInterval: 10_000 })
  : null);

export function track(distinctId: string, event: AnalyticsEvent, properties?: Record<string, string | number | boolean>) {
  posthog?.capture({ distinctId, event, properties });
}
