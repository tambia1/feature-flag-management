import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/health — for load balancers and the uptime check. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
