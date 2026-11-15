import type { Metadata } from "next";
import Link from "next/link";
import type { Variation } from "@/app/types";
import { Table } from "@/app/_components/Table";
import { getFlagByKey, getProjectContext, searchString } from "@/lib/flags/context";
import { describeTargeting, type TargetingSnapshot } from "@/lib/flags/describe";
import { formatWhen } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { HistoryFilter } from "./HistoryFilter";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage({ params, searchParams }: PageProps<"/projects/[projectKey]/flags/[flagKey]/history">) {
  const { projectKey, flagKey } = await params;
  const query = await searchParams;
  const user = await requireUser();
  const context = await getProjectContext(user, projectKey, searchString(query.env));

  if (!context) {
    return null;
  }

  const flag = await getFlagByKey(context.project.id, flagKey);
  const visibleEnvironmentIds = context.project.environments.map((item) => item.id);
  const filter = searchString(query.history);
  const selectedId = searchString(query.entry);

  const entries = await prisma.flagHistory.findMany({
    where: {
      flagId: flag.id,
      ...(filter ? { environmentId: filter } : { OR: [{ environmentId: null }, { environmentId: { in: visibleEnvironmentIds } }] }),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      createdAt: true,
      userName: true,
      change: true,
      comment: true,
      before: true,
      after: true,
      environment: { select: { name: true } },
    },
  });

  const selected = entries.find((entry) => entry.id === selectedId);
  const linkFor = (id: string) => {
    const linkParams = new URLSearchParams({
      ...(context.environment && { env: context.environment.key }),
      ...(filter && { history: filter }),
      entry: id,
    });
    return `?${linkParams}`;
  };

  return (
    <div className={styles.history}>
      <HistoryFilter environments={context.project.environments.map((item) => ({ value: item.id, label: item.name }))} />
      <Table headers={["When", "Who", "Environment", "Change", "Comment"]} isEmpty={entries.length === 0} emptyText="No changes yet.">
        {entries.map((entry) => (
          <tr key={entry.id} aria-selected={entry.id === selectedId} className={styles.row}>
            <td>
              <Link href={linkFor(entry.id)} className={styles.link}>
                {formatWhen(entry.createdAt)}
              </Link>
            </td>
            <td>{entry.userName}</td>
            <td>{entry.environment?.name ?? "—"}</td>
            <td>{entry.change}</td>
            <td>{entry.comment ?? "—"}</td>
          </tr>
        ))}
      </Table>
      {selected && (
        <section className={styles.details} aria-label="Change details">
          <h2 className={styles.detailsTitle}>
            Change details · {formatWhen(selected.createdAt)} · {selected.userName}
            {selected.environment && ` · ${selected.environment.name}`}
          </h2>
          {selected.before || selected.after ? (
            <dl className={styles.diff}>
              <dt>Before:</dt>
              <dd>{describe(selected.before, flag.variations as Variation[])}</dd>
              <dt>After:</dt>
              <dd>{describe(selected.after, flag.variations as Variation[])}</dd>
            </dl>
          ) : (
            <p>{selected.change}</p>
          )}
        </section>
      )}
    </div>
  );
}

function describe(snapshot: unknown, variations: Variation[]) {
  if (!snapshot || typeof snapshot !== "object") {
    return "—";
  }

  if ("rules" in snapshot) {
    return describeTargeting(snapshot as TargetingSnapshot, variations).map((line, index) => <div key={index}>{line}</div>);
  }

  if ("isOn" in snapshot) {
    return (snapshot as { isOn: boolean }).isOn ? "On" : "Off";
  }

  return JSON.stringify(snapshot);
}
