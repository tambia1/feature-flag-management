import { registry } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = process.env.METRICS_TOKEN;

  if (token && request.headers.get("authorization") !== `Bearer ${token}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  return new Response(await registry.metrics(), { headers: { "Content-Type": registry.contentType } });
}
