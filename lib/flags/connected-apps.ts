import "server-only";
import type { ConnectedApp } from "@/app/types";
import { getReportedServers } from "../server-status";

export async function getConnectedApps(environmentId: string): Promise<ConnectedApp[]> {
  const servers = await getReportedServers();
  const totals = new Map<string, number>();

  for (const server of servers) {
    if (server.isSilent) {
      continue;
    }

    for (const [applicationName, connections] of Object.entries(server.streams?.[environmentId] ?? {})) {
      totals.set(applicationName, (totals.get(applicationName) ?? 0) + connections);
    }
  }

  return [...totals]
    .map(([applicationName, connections]) => ({ applicationName, connections }))
    .sort((a, b) => b.connections - a.connections || a.applicationName.localeCompare(b.applicationName));
}
