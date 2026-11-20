import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmAction } from "@/app/_components/ConfirmAction";
import { Table } from "@/app/_components/Table";
import { getProjectContext, searchString } from "@/lib/flags/context";
import { formatWhen } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { NoAccess } from "../../../_components/NoAccess";
import { Page } from "../../../_components/Page";
import { ListFilters } from "../../../_components/ListFilters";
import { deleteFlag, restoreFlag } from "../flags/actions";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Archived flags" };

export default async function ArchivedFlagsPage({ params, searchParams }: PageProps<"/projects/[projectKey]/archived">) {
  const { projectKey } = await params;
  const query = await searchParams;
  const user = await requireUser();
  const context = await getProjectContext(user, projectKey, searchString(query.env));

  if (!context) {
    return (
      <Page title="Archived flags">
        <NoAccess />
      </Page>
    );
  }

  const { project, environment, canEditFlags } = context;
  const search = searchString(query.search).trim();

  const flags = await prisma.flag.findMany({
    where: {
      projectId: project.id,
      archivedAt: { not: null },
      ...(search && {
        OR: [{ key: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }],
      }),
    },
    orderBy: { archivedAt: "desc" },
    select: {
      id: true,
      key: true,
      name: true,
      archivedAt: true,
      history: { where: { change: "archived" }, orderBy: { createdAt: "desc" }, take: 1, select: { userName: true } },
    },
  });

  return (
    <Page title="Archived flags" subtitle={project.name}>
      <ListFilters withStatus={false} />
      <Table headers={["Key", "Name", "Archived", "By", ""]} isEmpty={flags.length === 0} emptyText="No archived flags.">
        {flags.map((flag) => (
          <tr key={flag.id}>
            <td>
              <Link href={`/projects/${project.key}/flags/${flag.key}/settings?env=${environment.key}`} className={styles.key}>
                {flag.key}
              </Link>
            </td>
            <td>{flag.name}</td>
            <td>{flag.archivedAt && formatWhen(flag.archivedAt)}</td>
            <td>{flag.history[0]?.userName ?? "—"}</td>
            <td className={styles.actions}>
              <ConfirmAction
                action={restoreFlag}
                fields={{ flagId: flag.id }}
                triggerLabel="Restore"
                title="Restore flag?"
                text={`"${flag.key}" goes back in the flag list, OFF in every environment.`}
                confirmLabel="Restore"
                danger={false}
                disabled={!canEditFlags}
              />
              <span aria-hidden="true"> · </span>
              <ConfirmAction
                action={deleteFlag}
                fields={{ flagId: flag.id }}
                triggerLabel="Delete"
                triggerColor="danger"
                title="Delete flag?"
                text={`This permanently deletes "${flag.key}" and its history.\nApps get the fallback value from their code.\nThis can't be undone.`}
                confirmLabel="Delete flag"
                disabled={!canEditFlags}
              />
            </td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}
