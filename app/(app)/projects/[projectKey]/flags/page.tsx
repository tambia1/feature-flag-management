import { Flag, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/app/_components/Button";
import { EmptyState } from "@/app/_components/EmptyState";
import { LinkButton } from "@/app/_components/LinkButton";
import { Table } from "@/app/_components/Table";
import { isProduction } from "@/lib/environments";
import { getProjectContext, searchString } from "@/lib/flags/context";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { NoAccess } from "../../../_components/NoAccess";
import { Page } from "../../../_components/Page";
import { ListFilters } from "../../../_components/ListFilters";
import { FlagToggle } from "./_components/FlagToggle";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Flags" };

export default async function FlagsPage({ params, searchParams }: PageProps<"/projects/[projectKey]/flags">) {
  const { projectKey } = await params;
  const query = await searchParams;
  const user = await requireUser();
  const context = await getProjectContext(user, projectKey, searchString(query.env));

  if (!context) {
    return (
      <Page title="Flags">
        <NoAccess />
      </Page>
    );
  }

  const { project, environment, role, canEditFlags } = context;
  const search = searchString(query.search).trim();
  const status = searchString(query.status);

  const [total, flags] = await Promise.all([
    prisma.flag.count({ where: { projectId: project.id, archivedAt: null } }),
    prisma.flag.findMany({
      where: {
        projectId: project.id,
        archivedAt: null,
        ...(search && {
          OR: [{ key: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }],
        }),
        ...(status && { environments: { some: { environmentId: environment.id, isOn: status === "on" } } }),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        environments: { where: { environmentId: environment.id }, select: { isOn: true } },
      },
    }),
  ]);

  const newFlagButton = canEditFlags ? (
    <LinkButton href={`/projects/${project.key}/flags/new?env=${environment.key}`} variant="primary">
      <Plus size={16} /> New flag
    </LinkButton>
  ) : (
    <Button variant="primary" disabled title="Only editors can create flags">
      + New flag
    </Button>
  );

  if (project.environments.length === 0 || total === 0) {
    return (
      <Page title="Flags" subtitle={`${project.name} · ${environment.name}`}>
        <EmptyState icon={Flag} title="No flags yet" text={"Create your first flag to turn a feature\non or off without deploying."}>
          {canEditFlags && newFlagButton}
        </EmptyState>
      </Page>
    );
  }

  return (
    <Page title="Flags" subtitle={`${project.name} · ${environment.name}`} actions={newFlagButton}>
      <ListFilters />
      <Table headers={["On", "Key", "Name", "Description"]} isEmpty={flags.length === 0} emptyText="No flags match your search.">
        {flags.map((flag) => (
          <tr key={flag.id}>
            <td>
              <FlagToggle
                flagId={flag.id}
                flagKey={flag.key}
                environmentId={environment.id}
                environmentName={environment.name}
                isOn={flag.environments[0]?.isOn ?? false}
                isProduction={isProduction(environment)}
                disabled={role !== "EDITOR"}
              />
            </td>
            <td>
              <Link href={`/projects/${project.key}/flags/${flag.key}?env=${environment.key}`} className={styles.key}>
                {flag.key}
              </Link>
            </td>
            <td>{flag.name}</td>
            <td className={styles.description}>{flag.description}</td>
          </tr>
        ))}
      </Table>
      {role !== "EDITOR" && <p className={styles.hint}>You are a viewer in {environment.name}, so toggles are read-only.</p>}
    </Page>
  );
}
