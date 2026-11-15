import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmAction } from "@/app/_components/ConfirmAction";
import { searchString } from "@/lib/flags/context";
import { prisma } from "@/lib/prisma";
import { requireCompanyAdmin } from "@/lib/session";
import { Card } from "../../_components/Card";
import { Page } from "../../_components/Page";
import { CreateNameForm } from "../_components/CreateNameForm";
import { RenameForm } from "../_components/RenameForm";
import { createTeam, deleteTeam, renameTeam } from "../actions";
import { MembersEditor } from "./MembersEditor";
import { PermissionsGrid } from "./PermissionsGrid";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage({ searchParams }: PageProps<"/settings/teams">) {
  const admin = await requireCompanyAdmin();
  const selectedId = searchString((await searchParams).team);

  const [teams, users, projects] = await Promise.all([
    prisma.team.findMany({
      where: { companyId: admin.companyId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        members: { select: { user: { select: { id: true, name: true } } }, orderBy: { user: { name: "asc" } } },
        roles: { select: { environmentId: true, role: true } },
      },
    }),
    prisma.user.findMany({ where: { companyId: admin.companyId }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
    prisma.project.findMany({
      where: { companyId: admin.companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, environments: { orderBy: { createdAt: "asc" }, select: { id: true, name: true } } },
    }),
  ]);

  const team = teams.find((item) => item.id === selectedId) ?? teams[0];

  return (
    <Page title="Teams">
      <Card title="Add team">
        <CreateNameForm action={createTeam} label="Team name" placeholder="e.g. Mobile" submitLabel="Add team" />
      </Card>
      <div className={styles.layout}>
        <nav aria-label="Teams" className={styles.list}>
          {teams.length === 0 && <p className={styles.hint}>No teams yet.</p>}
          {teams.map((item) => (
            <Link key={item.id} href={`?team=${item.id}`} className={styles.item} aria-current={item.id === team?.id ? "page" : undefined}>
              {item.name}
            </Link>
          ))}
        </nav>
        {team && (
          <section className={styles.panel} aria-label={team.name}>
            <div className={styles.panelHead}>
              <RenameForm key={team.id} action={renameTeam} idName="teamId" id={team.id} value={team.name} label="Team name" />
              <ConfirmAction
                action={deleteTeam}
                fields={{ teamId: team.id }}
                triggerLabel="Delete"
                title="Delete team?"
                text={`Delete "${team.name}"?\nIts members keep their accounts but lose this team's access.`}
                confirmLabel="Delete"
              />
            </div>
            <h3 className={styles.subtitle}>Members</h3>
            <MembersEditor
              teamId={team.id}
              members={team.members.map((member) => member.user)}
              candidates={users.filter((user) => !team.members.some((member) => member.user.id === user.id))}
            />
            <h3 className={styles.subtitle}>Permissions</h3>
            <PermissionsGrid
              key={`${team.id}-${JSON.stringify(team.roles)}`}
              teamId={team.id}
              projects={projects}
              roles={Object.fromEntries(team.roles.map((role) => [role.environmentId, role.role]))}
            />
          </section>
        )}
      </div>
      <p className={styles.hint}>
        Each team has one role per environment: none / viewer / editor. A user gets the highest role from all their teams — admins too.
        <br />
        New projects and environments start with role none for every team. Every change goes to the company log.
      </p>
    </Page>
  );
}
