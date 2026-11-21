import type { Metadata } from "next";
import { Table } from "@/app/_components/Table";
import { getEnvironmentRoles } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Page } from "../../_components/Page";
import styles from "./page.module.css";
import { Text } from "@/app/_components/Text";

export const metadata: Metadata = { title: "My teams & roles" };

export default async function MyRolesPage() {
  const user = await requireUser();

  const [teams, projects, roles] = await Promise.all([
    prisma.team.findMany({ where: { members: { some: { userId: user.id } } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.project.findMany({
      where: { companyId: user.companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, environments: { orderBy: { createdAt: "asc" }, select: { id: true, name: true } } },
    }),
    getEnvironmentRoles(user.id),
  ]);

  return (
    <Page title="My teams & roles" subtitle={`${user.name} · ${user.email} · ${user.role.toLowerCase()}`}>
      <section className={styles.section}>
        <Text variant="subheading" as="h2">
          Teams
        </Text>
        {teams.length === 0 ? (
          <Text variant="small" color="muted">
            You are not in any team yet.
          </Text>
        ) : (
          <ul className={styles.chips}>
            {teams.map((team) => (
              <li key={team.id} className={styles.chip}>
                {team.name}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={styles.section}>
        <Text variant="subheading" as="h2">
          My role per environment
        </Text>
        <Table headers={["Project", "Environments"]} isEmpty={projects.length === 0} emptyText="No projects yet.">
          {projects.map((project) => (
            <tr key={project.id}>
              <td>{project.name}</td>
              <td>
                <ul className={styles.roles}>
                  {project.environments.map((environment) => {
                    const role = roles.get(environment.id)?.toLowerCase() ?? "none";
                    return (
                      <li key={environment.id}>
                        <Text variant="plain" color="muted">
                          {environment.name}:
                        </Text>{" "}
                        <span className={role === "none" ? styles.none : styles.role}>{role}</span>
                      </li>
                    );
                  })}
                </ul>
              </td>
            </tr>
          ))}
        </Table>
      </section>
    </Page>
  );
}
