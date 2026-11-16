import type { CompanyActivity } from "@/app/types";
import { prisma } from "@/lib/prisma";

const MONTHS = 12;

export async function getCompanyActivity(companyId: string, now = new Date()): Promise<CompanyActivity> {
  const starts = Array.from(
    { length: MONTHS },
    (_, index) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1 - index), 1)),
  );
  const ends = starts.map((start) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)));

  const [users, projects, teams, operations] = await Promise.all([
    prisma.user.findMany({ where: { companyId }, select: { createdAt: true } }),
    prisma.project.findMany({ where: { companyId }, select: { createdAt: true } }),
    prisma.team.findMany({ where: { companyId }, select: { createdAt: true } }),
    prisma.$queryRaw<{ month: Date; count: number }[]>`
      SELECT date_trunc('month', "createdAt") AS month, count(*)::int AS count
      FROM logs
      WHERE "companyId" = ${companyId} AND "createdAt" >= ${starts[0]}
      GROUP BY 1`,
  ]);

  const existingAt = (rows: { createdAt: Date }[]) => ends.map((end) => rows.filter((row) => row.createdAt < end).length);

  return {
    months: starts.map((start) => start.toLocaleDateString("en", { month: "short", year: "numeric", timeZone: "UTC" })),
    series: [
      { key: "users", label: "Users", values: existingAt(users) },
      { key: "projects", label: "Projects", values: existingAt(projects) },
      { key: "teams", label: "Teams", values: existingAt(teams) },
      {
        key: "operations",
        label: "Operations",
        values: starts.map((start) => operations.find((row) => row.month.getTime() === start.getTime())?.count ?? 0),
      },
    ],
  };
}
