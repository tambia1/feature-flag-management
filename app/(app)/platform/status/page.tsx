import type { Metadata } from "next";
import { Table } from "@/app/_components/Table";
import type { ServiceCheck } from "@/app/types";
import { formatDuration } from "@/lib/format";
import { getReportedServers, PAGE_REFRESH_MS, STATUS_WINDOW_MINUTES } from "@/lib/server-status";
import { checkServices } from "@/lib/service-checks";
import { requirePlatformAdmin } from "@/lib/session";
import { Page } from "../../_components/Page";
import { StatTile } from "../../_components/StatTile";
import { AutoRefresh } from "../../_components/AutoRefresh";
import { StatusBadge } from "./StatusBadge";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Status" };

const decimal = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const milliseconds = (value: number | null) => (value === null ? "—" : `${decimal.format(value)} ms`);

export default async function StatusPage() {
  await requirePlatformAdmin();

  const [servers, services] = await Promise.all([getReportedServers(), checkServices()]);
  const now = Date.now();
  const reporting = servers.filter((server) => !server.isSilent);
  const silent = servers.length - reporting.length;
  const sum = (pick: (server: (typeof servers)[number]) => number) => reporting.reduce((total, server) => total + pick(server), 0);
  const requestsPerSecond = sum((server) => server.requestsPerSecond);
  const weightedResponse = sum((server) => (server.averageResponseMs ?? 0) * server.requestsPerSecond);

  const appServers: ServiceCheck = {
    name: "App servers",
    state: silent > 0 ? "down" : "up",
    detail: silent > 0 ? `${silent} of ${servers.length} stopped reporting` : `${servers.length} running`,
  };

  return (
    <Page
      title="Status"
      subtitle={`Updates every ${PAGE_REFRESH_MS / 1000} seconds. Counts cover the last ${STATUS_WINDOW_MINUTES} minutes.`}
      actions={<AutoRefresh intervalMs={PAGE_REFRESH_MS} />}
    >
      <dl className={styles.tiles}>
        <StatTile label="Servers" value={reporting.length} detail={silent > 0 ? `${silent} not reporting` : "All reporting"} />
        <StatTile label="SDK connections" value={sum((server) => server.openStreams)} detail="Open streams right now" />
        <StatTile label="SDK requests / s" value={decimal.format(requestsPerSecond)} />
        <StatTile label="Average response" value={milliseconds(requestsPerSecond > 0 ? weightedResponse / requestsPerSecond : null)} />
        <StatTile label="Errors" value={sum((server) => server.errors)} detail="Server errors (5xx)" />
        <StatTile label="Rate limited" value={sum((server) => server.rateLimited)} detail="Rejected for too many requests" />
      </dl>

      <section className={styles.section}>
        <h2 className={styles.heading}>Services</h2>
        <Table headers={["Service", "Status", "Detail"]}>
          {[appServers, ...services].map((service) => (
            <tr key={service.name}>
              <td>{service.name}</td>
              <td>
                <StatusBadge state={service.state} text={{ up: "Up", down: "Down", off: "Off" }[service.state]} />
              </td>
              <td className={styles.detail}>{service.detail}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Servers</h2>
        <Table
          headers={[
            "Server",
            "Status",
            "Up for",
            "SDK connections",
            "Requests / s",
            "Avg response",
            "Errors",
            "Rate limited",
            "Memory",
            "Event loop delay",
          ]}
        >
          {servers.map((server) => (
            <tr key={server.id}>
              <td>
                <span className={styles.host}>
                  {server.host}:{server.pid}
                </span>
                {server.isThisServer && <span className={styles.detail}> (this page)</span>}
              </td>
              <td>
                {server.isSilent ? (
                  <StatusBadge state="down" text={`Silent ${formatDuration(now - server.reportedAt)}`} />
                ) : (
                  <StatusBadge state="up" text="Up" />
                )}
              </td>
              <td className={styles.number}>{formatDuration(now - server.startedAt)}</td>
              <td className={styles.number}>{server.openStreams}</td>
              <td className={styles.number}>{decimal.format(server.requestsPerSecond)}</td>
              <td className={styles.number}>{milliseconds(server.averageResponseMs)}</td>
              <td className={styles.number}>{server.errors}</td>
              <td className={styles.number}>{server.rateLimited}</td>
              <td className={styles.number}>{Math.round(server.memoryMb)} MB</td>
              <td className={styles.number}>{milliseconds(server.eventLoopDelayMs)}</td>
            </tr>
          ))}
        </Table>
      </section>
    </Page>
  );
}
