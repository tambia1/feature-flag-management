import { getFlagsForSdkKey } from "@/lib/flags/cache";
import { trackStream } from "@/lib/flags/streams";
import { sdkMetrics } from "@/lib/metrics";
import { onFlagChange } from "@/lib/pubsub";
import { readSdkKey, SDK_CORS_HEADERS } from "@/lib/sdk";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

export async function GET(request: Request) {
  const sdkKey = readSdkKey(request);
  const environment = sdkKey ? await getFlagsForSdkKey(sdkKey) : null;

  if (!environment) {
    return Response.json({ error: "Unknown SDK key" }, { status: 401, headers: SDK_CORS_HEADERS });
  }

  const applicationName = (new URL(request.url).searchParams.get("applicationName") ?? "").trim().slice(0, 100);
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup();
        }
      };

      send("retry: 3000\nevent: ready\ndata: {}\n\n");
      sdkMetrics.openStreams.inc();
      const untrack = trackStream(environment.environmentId, applicationName);

      const unsubscribe = onFlagChange((environmentId) => {
        if (environmentId === environment.environmentId) {
          send("event: changed\ndata: {}\n\n");
        }
      });

      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);

      let closed = false;
      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        sdkMetrics.openStreams.dec();
        untrack();
        try {
          controller.close();
        } catch {}
      };

      request.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      ...SDK_CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}
