import { z } from "zod";
import type { EvaluationContext } from "@/app/types";
import { getFlagsForSdkKey } from "@/lib/flags/cache";
import { recordContext } from "@/lib/flags/contexts";
import { getFlagResults } from "@/lib/flags/evaluate";
import { logger } from "@/lib/logger";
import { sdkMetrics } from "@/lib/metrics";
import { readSdkKey, SDK_CORS_HEADERS, takeRateLimitToken } from "@/lib/sdk";

const bodySchema = z.object({
  context: z.object({ key: z.string().min(1).max(256) }).catchall(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  applicationName: z.string().trim().max(100).optional(),
});

export async function POST(request: Request) {
  const stopTimer = sdkMetrics.flagsDuration.startTimer();
  const respond = (body: unknown, status: number) => {
    stopTimer({ status: String(status) });
    return Response.json(body, { status, headers: SDK_CORS_HEADERS });
  };

  const sdkKey = readSdkKey(request);

  if (!sdkKey) {
    return respond({ error: "Missing SDK key in the Authorization header" }, 401);
  }

  if (!takeRateLimitToken(sdkKey)) {
    return respond({ error: "Too many requests" }, 429);
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return respond({ error: 'Body must be { "context": { "key": "user-42", ... } }' }, 400);
  }

  try {
    const environment = await getFlagsForSdkKey(sdkKey);

    if (!environment) {
      return respond({ error: "Unknown SDK key" }, 401);
    }

    const context = parsed.data.context as EvaluationContext;
    const results = getFlagResults(environment.flags, context);
    recordContext(environment.environmentId, parsed.data.applicationName ?? "", context, results);

    return respond(Object.fromEntries(Object.entries(results).map(([key, result]) => [key, result.value])), 200);
  } catch (err) {
    logger.error({ err }, "SDK flags request failed");
    return respond({ error: "Server error" }, 500);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: SDK_CORS_HEADERS });
}
