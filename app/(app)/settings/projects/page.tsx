import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmAction } from "@/app/_components/ConfirmAction";
import { Table } from "@/app/_components/Table";
import { searchString } from "@/lib/flags/context";
import { prisma } from "@/lib/prisma";
import { requireCompanyAdmin } from "@/lib/session";
import { Card } from "../../_components/Card";
import { Page } from "../../_components/Page";
import { CreateNameForm } from "../_components/CreateNameForm";
import { RenameForm } from "../_components/RenameForm";
import { addEnvironment, createProject, deleteProject, renameProject } from "../actions";
import { EnvironmentRow } from "./EnvironmentRow";
import styles from "./page.module.css";
import { Text } from "@/app/_components/Text";

export const metadata: Metadata = { title: "Projects & environments" };

export default async function ProjectsPage({ searchParams }: PageProps<"/settings/projects">) {
  const admin = await requireCompanyAdmin();
  const selectedId = searchString((await searchParams).project);

  const projects = await prisma.project.findMany({
    where: { companyId: admin.companyId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      key: true,
      _count: { select: { flags: true } },
      environments: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, key: true, sdkKey: true } },
    },
  });

  const project = projects.find((item) => item.id === selectedId) ?? projects[0];

  return (
    <Page title="Projects & environments">
      <Card title="Add project">
        <CreateNameForm
          action={createProject}
          label="Project name"
          placeholder="e.g. Google Docs"
          submitLabel="Add project"
          withKey={{ label: "Key", placeholder: "google-docs" }}
        />
      </Card>
      <div className={styles.layout}>
        <nav aria-label="Projects" className={styles.list}>
          {projects.length === 0 && (
            <Text variant="small" color="muted">
              No projects yet.
            </Text>
          )}
          {projects.map((item) => (
            <Link
              key={item.id}
              href={`?project=${item.id}`}
              className={styles.item}
              aria-current={item.id === project?.id ? "page" : undefined}
            >
              {item.name}
            </Link>
          ))}
        </nav>
        {project && (
          <section className={styles.panel} aria-label={project.name}>
            <div className={styles.panelHead}>
              <RenameForm
                key={project.id}
                action={renameProject}
                idName="projectId"
                id={project.id}
                value={project.name}
                label="Project name"
              />
              <ConfirmAction
                action={deleteProject}
                fields={{ projectId: project.id }}
                triggerLabel="Delete"
                triggerColor="danger"
                title="Delete project"
                text={`This deletes "${project.name}",\nits ${project.environments.length} environments and ${project._count.flags} flags.\nThis can't be undone.`}
                confirmLabel="Delete"
              />
            </div>
            <Text variant="small" color="muted">
              Key: {project.key} (can&apos;t change — used in code)
            </Text>
            <Text variant="label" as="h3" color="muted" className={styles.subtitle}>
              Environments
            </Text>
            <CreateNameForm
              action={addEnvironment}
              fields={{ projectId: project.id }}
              label="Environment name"
              placeholder="e.g. testing"
              submitLabel="Add environment"
              withKey={{ label: "Key", placeholder: "test" }}
            />
            <Table
              headers={["Name", "Key", "Environment SDK key", ""]}
              isEmpty={project.environments.length === 0}
              emptyText="No environments yet. Add one above — most apps start with development, staging and production."
              editable
            >
              {project.environments.map((environment) => (
                <EnvironmentRow key={environment.id} environment={environment} />
              ))}
            </Table>
          </section>
        )}
      </div>
    </Page>
  );
}
