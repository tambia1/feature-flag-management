import type { Metadata } from "next";
import { LinkButton } from "@/app/_components/LinkButton";
import { Table } from "@/app/_components/Table";
import type { ServiceCheck } from "@/app/types";
import { formatDuration } from "@/lib/format";
import { getReportedServers, PAGE_REFRESH_MS } from "@/lib/server-status";
import { checkServices } from "@/lib/service-checks";
import { requirePlatformAdmin } from "@/lib/session";
import { Page } from "../../_components/Page";
import { AutoRefresh } from "../../_components/AutoRefresh";
import { StatusBadge } from "./StatusBadge";
import styles from "./page.module.css";
import { Text } from "@/app/_components/Text";

export const metadata: Metadata = { title: "Status" };

export default async function StatusPage() {
  await requirePlatformAdmin();

  const [servers, services] = await Promise.all([getReportedServers(), checkServices()]);
  const now = Date.now();
  const silent = servers.filter((server) => server.isSilent).length;
  const grafanaUrl = process.env.GRAFANA_URL;

  const appServers: ServiceCheck = {
    name: "App servers",
    state: silent > 0 ? "down" : "up",
    detail: silent > 0 ? `${silent} of ${servers.length} stopped reporting` : `${servers.length} running`,
  };

  return (
    <Page
      title="Status"
      subtitle={`Updates every ${PAGE_REFRESH_MS / 1000} seconds. Traffic, errors and performance are in Grafana.`}
      actions={
        <>
          {grafanaUrl && (
            <LinkButton href={grafanaUrl} target="_blank" rel="noreferrer" variant="outline">
              Open Grafana
            </LinkButton>
          )}
          <AutoRefresh intervalMs={PAGE_REFRESH_MS} />
        </>
      }
    >
      <section className={styles.section}>
        <Text variant="heading">Services</Text>
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
        <Text variant="heading">Servers</Text>
        <Table headers={["Server", "Status", "Up for"]}>
          {servers.map((server) => (
            <tr key={server.id}>
              <td>
                <span className={styles.host}>
                  {server.host}:{server.pid}
                </span>
                {server.isThisServer && (
                  <Text variant="plain" color="muted">
                    {" "}
                    (this page)
                  </Text>
                )}
              </td>
              <td>
                {server.isSilent ? (
                  <StatusBadge state="down" text={`Silent ${formatDuration(now - server.reportedAt)}`} />
                ) : (
                  <StatusBadge state="up" text="Up" />
                )}
              </td>
              <td className={styles.number}>{formatDuration(now - server.startedAt)}</td>
            </tr>
          ))}
        </Table>
      </section>
    </Page>
  );
}
