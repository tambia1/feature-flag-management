import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/app/_components/EmptyState";
import { Table } from "@/app/_components/Table";
import { getConnectedApps } from "@/lib/flags/connected-apps";
import { getProjectContext, searchString } from "@/lib/flags/context";
import { formatValue } from "@/lib/flags/values";
import { formatDuration } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import type { JsonValue } from "@/app/types";
import { ListFilters } from "../../../_components/ListFilters";
import { NoAccess } from "../../../_components/NoAccess";
import { Page } from "../../../_components/Page";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Contexts" };

const LIMIT = 100;

export default async function ContextsPage({ params, searchParams }: PageProps<"/projects/[projectKey]/contexts">) {
  const { projectKey } = await params;
  const query = await searchParams;
  const user = await requireUser();
  const context = await getProjectContext(user, projectKey, searchString(query.env));

  if (!context) {
    return (
      <Page title="Contexts">
        <NoAccess />
      </Page>
    );
  }

  const { project, environment } = context;
  const search = searchString(query.search).trim();

  const [connectedApps, contexts] = await Promise.all([
    getConnectedApps(environment.id),
    prisma.context.findMany({
      where: { environmentId: environment.id, ...(search && { key: { contains: search, mode: "insensitive" } }) },
      orderBy: { lastSeenAt: "desc" },
      take: LIMIT,
      select: { id: true, key: true, application: true, attributes: true, lastSeenAt: true },
    }),
  ]);

  const now = Date.now();

  return (
    <Page title="Contexts" subtitle={`${project.name} · ${environment.name}`}>
      <section className={styles.section}>
        <h2 className={styles.heading}>Connected apps</h2>
        <Table headers={["App", "Open connections"]} isEmpty={connectedApps.length === 0} emptyText="No apps are connected right now.">
          {connectedApps.map((app) => (
            <tr key={app.application}>
              <td>{app.application || <span className={styles.muted}>Unnamed app</span>}</td>
              <td className={styles.number}>{app.connections}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Contexts</h2>
        {contexts.length === 0 && !search ? (
          <EmptyState icon={Users} title="No contexts yet" text={"Contexts appear here when an app\nreads flags from this environment."} />
        ) : (
          <>
            <ListFilters withStatus={false} placeholder="Search by context key" />
            <Table
              headers={["Context key", "App", "Attributes", "Last seen"]}
              isEmpty={contexts.length === 0}
              emptyText="No contexts match your search."
            >
              {contexts.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/projects/${project.key}/contexts/${item.id}?env=${environment.key}`} className={styles.key}>
                      {item.key}
                    </Link>
                  </td>
                  <td>{item.application || <span className={styles.muted}>Unnamed app</span>}</td>
                  <td className={styles.attributes}>
                    {Object.entries(item.attributes as Record<string, JsonValue>)
                      .map(([name, value]) => `${name}: ${formatValue(value)}`)
                      .join(", ") || "—"}
                  </td>
                  <td className={styles.number}>{formatDuration(now - item.lastSeenAt.getTime())} ago</td>
                </tr>
              ))}
            </Table>
            {contexts.length === LIMIT && <p className={styles.muted}>Showing the {LIMIT} most recently seen contexts.</p>}
          </>
        )}
      </section>
    </Page>
  );
}
