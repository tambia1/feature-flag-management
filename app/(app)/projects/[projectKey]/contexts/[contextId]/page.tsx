import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Table } from "@/app/_components/Table";
import { loadFlagConfigs } from "@/lib/flags/cache";
import { getProjectContext, searchString } from "@/lib/flags/context";
import { getFlagResults } from "@/lib/flags/evaluate";
import { describeReason } from "@/lib/flags/reasons";
import { formatValue } from "@/lib/flags/values";
import { formatDuration } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { NoAccess } from "../../../../_components/NoAccess";
import { Page } from "../../../../_components/Page";
import styles from "./page.module.css";
import { Text } from "@/app/_components/Text";

export const metadata: Metadata = { title: "Context" };

export default async function ContextPage({ params, searchParams }: PageProps<"/projects/[projectKey]/contexts/[contextId]">) {
  const { projectKey, contextId } = await params;
  const query = await searchParams;
  const user = await requireUser();
  const projectContext = await getProjectContext(user, projectKey, searchString(query.env));

  if (!projectContext) {
    return (
      <Page title="Context">
        <NoAccess />
      </Page>
    );
  }

  const { project } = projectContext;
  const item = await prisma.context.findFirst({
    where: { id: contextId, environmentId: { in: project.environments.map((environment) => environment.id) } },
    select: { key: true, applicationName: true, attributes: true, lastSeenAt: true, environmentId: true },
  });

  if (!item) {
    notFound();
  }

  const environment = project.environments.find((candidate) => candidate.id === item.environmentId)!;
  const sentAttributes = item.attributes as Record<string, string | number | boolean | null>;
  const attributes = Object.entries(sentAttributes);
  const flags = await loadFlagConfigs(item.environmentId);
  const results = Object.entries(getFlagResults(flags, { ...sentAttributes, key: item.key })).sort(([a], [b]) => a.localeCompare(b));
  const flagHref = (flagKey: string) => `/projects/${project.key}/flags/${flagKey}?env=${environment.key}`;

  return (
    <Page
      title={item.key}
      subtitle={`${item.applicationName || "Unnamed app"} · ${project.name} · ${environment.name} · last seen ${formatDuration(Date.now() - item.lastSeenAt.getTime())} ago`}
    >
      <Link href={`/projects/${project.key}/contexts?env=${environment.key}`} className={styles.back}>
        <ArrowLeft size={14} /> Contexts
      </Link>

      <section className={styles.section}>
        <Text variant="heading">Attributes it sent</Text>
        <Table headers={["Attribute", "Value"]} isEmpty={attributes.length === 0} emptyText="Only the key was sent.">
          {attributes.map(([name, value]) => (
            <tr key={name}>
              <td className={styles.code}>{name}</td>
              <td className={styles.code}>{formatValue(value)}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section className={styles.section}>
        <Text variant="heading">Flags it gets</Text>
        <Table headers={["Flag", "Value", "Reason"]} isEmpty={results.length === 0} emptyText="No flags in this environment.">
          {results.map(([flagKey, result]) => (
            <tr key={flagKey}>
              <td>
                <Link href={flagHref(flagKey)} className={styles.link}>
                  {flagKey}
                </Link>
              </td>
              <td className={styles.code}>{formatValue(result.value)}</td>
              <td>{describeReason(result.reason)}</td>
            </tr>
          ))}
        </Table>
      </section>
    </Page>
  );
}
