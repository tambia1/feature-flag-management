import "server-only";
import type { CompanySdkConnections, ConnectedApp, SdkConnection, SdkConnections } from "@/app/types";
import { prisma } from "../prisma";
import { getReportedServers } from "../server-status";

async function countOpenStreams(): Promise<Map<string, Map<string, number>>> {
  const servers = await getReportedServers();
  const byEnvironment = new Map<string, Map<string, number>>();

  for (const server of servers) {
    if (server.isSilent) {
      continue;
    }

    for (const [environmentId, apps] of Object.entries(server.streams ?? {})) {
      const totals = byEnvironment.get(environmentId) ?? new Map<string, number>();

      for (const [applicationName, connections] of Object.entries(apps)) {
        totals.set(applicationName, (totals.get(applicationName) ?? 0) + connections);
      }

      byEnvironment.set(environmentId, totals);
    }
  }

  return byEnvironment;
}

export async function getConnectedApps(environmentId: string): Promise<ConnectedApp[]> {
  const totals = (await countOpenStreams()).get(environmentId) ?? new Map<string, number>();

  return [...totals]
    .map(([applicationName, connections]) => ({ applicationName, connections }))
    .sort((a, b) => b.connections - a.connections || a.applicationName.localeCompare(b.applicationName));
}

export async function getSdkConnections(): Promise<SdkConnections> {
  const byEnvironment = await countOpenStreams();
  const [companies, environments] = await Promise.all([
    prisma.company.findMany({ select: { id: true, name: true } }),
    prisma.environment.findMany({
      where: { id: { in: [...byEnvironment.keys()] } },
      select: { name: true, id: true, project: { select: { name: true, companyId: true } } },
    }),
  ]);
  const companyNames = new Map(companies.map((company) => [company.id, company.name]));

  const connections: SdkConnection[] = environments
    .flatMap((environment) =>
      [...(byEnvironment.get(environment.id) ?? [])].map(([applicationName, count]) => ({
        companyId: environment.project.companyId,
        companyName: companyNames.get(environment.project.companyId) ?? "",
        projectName: environment.project.name,
        environmentName: environment.name,
        applicationName,
        connections: count,
      })),
    )
    .sort(
      (a, b) =>
        b.connections - a.connections ||
        a.companyName.localeCompare(b.companyName) ||
        a.projectName.localeCompare(b.projectName) ||
        a.environmentName.localeCompare(b.environmentName) ||
        a.applicationName.localeCompare(b.applicationName),
    );

  const byCompany: CompanySdkConnections[] = companies
    .map((company) => {
      const rows = connections.filter((row) => row.companyId === company.id);
      return {
        companyId: company.id,
        companyName: company.name,
        connections: rows.reduce((total, row) => total + row.connections, 0),
        apps: rows.length,
      };
    })
    .sort((a, b) => b.connections - a.connections || a.companyName.localeCompare(b.companyName));

  return { companies: byCompany, connections };
}
