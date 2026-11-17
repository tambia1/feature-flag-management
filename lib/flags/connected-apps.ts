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

    for (const [application, connections] of Object.entries(server.streams?.[environmentId] ?? {})) {
      totals.set(application, (totals.get(application) ?? 0) + connections);
    }
  }

  return [...totals]
    .map(([application, connections]) => ({ application, connections }))
    .sort((a, b) => b.connections - a.connections || a.application.localeCompare(b.application));
}
