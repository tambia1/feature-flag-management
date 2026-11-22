import type { Metadata } from "next";
import { LinkButton } from "@/app/_components/LinkButton";
import { Table } from "@/app/_components/Table";
import { getSdkConnections } from "@/lib/flags/connected-apps";
import { PAGE_REFRESH_MS } from "@/lib/server-status";
import { requirePlatformAdmin } from "@/lib/session";
import { Page } from "../../_components/Page";
import { StatTile } from "../../_components/StatTile";
import { AutoRefresh } from "../../_components/AutoRefresh";
import styles from "./page.module.css";
import { Text } from "@/app/_components/Text";

export const metadata: Metadata = { title: "Status" };

export default async function StatusPage() {
  await requirePlatformAdmin();

  const { companies, connections } = await getSdkConnections();
  const grafanaUrl = process.env.GRAFANA_URL;
  const total = connections.reduce((sum, row) => sum + row.connections, 0);
  const connectedCompanies = companies.filter((company) => company.connections > 0).length;

  return (
    <Page
      title="Status"
      subtitle={`Open SDK connections across all companies. Updates every ${PAGE_REFRESH_MS / 1000} seconds.`}
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
      <dl className={styles.tiles}>
        <StatTile label="SDK connections" value={total} detail="Open streams right now" />
        <StatTile label="Companies" value={connectedCompanies} detail={`of ${companies.length} connected`} />
        <StatTile label="Apps" value={connections.length} detail="Connected app and environment pairs" />
      </dl>

      <section className={styles.section}>
        <Text variant="heading">Companies</Text>
        <Table headers={["Company", "SDK connections", "Apps"]} isEmpty={companies.length === 0} emptyText="No companies yet.">
          {companies.map((company) => (
            <tr key={company.companyId}>
              <td>{company.companyName}</td>
              <td className={styles.number}>{company.connections}</td>
              <td className={styles.number}>{company.apps}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section className={styles.section}>
        <Text variant="heading">Connections</Text>
        <Table
          headers={["Company", "Project", "Environment", "App", "SDK connections"]}
          isEmpty={connections.length === 0}
          emptyText="No SDK is connected right now."
        >
          {connections.map((row) => (
            <tr key={`${row.companyId}:${row.projectName}:${row.environmentName}:${row.applicationName}`}>
              <td>{row.companyName}</td>
              <td>{row.projectName}</td>
              <td>{row.environmentName}</td>
              <td>
                {row.applicationName || (
                  <Text variant="plain" color="muted">
                    Unnamed app
                  </Text>
                )}
              </td>
              <td className={styles.number}>{row.connections}</td>
            </tr>
          ))}
        </Table>
      </section>
    </Page>
  );
}
