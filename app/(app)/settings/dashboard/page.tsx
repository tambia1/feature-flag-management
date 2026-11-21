import type { Metadata } from "next";
import { Table } from "@/app/_components/Table";
import { formatWhen } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCompanyAdmin } from "@/lib/session";
import { StatTile } from "../../_components/StatTile";
import styles from "./page.module.css";
import { Text } from "@/app/_components/Text";

export const metadata: Metadata = { title: "Dashboard" };

const DAYS = 30;

export default async function DashboardPage() {
  const { companyId } = await requireCompanyAdmin();
  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  const [users, teams, projects, recentChanges, lastChange] = await Promise.all([
    prisma.user.findMany({ where: { companyId }, select: { role: true } }),
    prisma.team.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { members: true } } },
    }),
    prisma.project.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, key: true, _count: { select: { environments: true } }, flags: { select: { archivedAt: true } } },
    }),
    prisma.log.count({ where: { companyId, createdAt: { gte: since } } }),
    prisma.log.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  const projectRows = projects.map((project) => ({
    ...project,
    activeFlags: project.flags.filter((flag) => !flag.archivedAt).length,
    archivedFlags: project.flags.filter((flag) => flag.archivedAt).length,
  }));
  const sum = (pick: (row: (typeof projectRows)[number]) => number) => projectRows.reduce((total, row) => total + pick(row), 0);
  const admins = users.filter((user) => user.role === "ADMIN").length;

  return (
    <>
      <dl className={styles.tiles}>
        <StatTile label="Users" value={users.length} detail={`${admins} ${admins === 1 ? "admin" : "admins"}`} />
        <StatTile label="Teams" value={teams.length} />
        <StatTile label="Projects" value={projects.length} detail={`${sum((row) => row._count.environments)} environments`} />
        <StatTile label="Active flags" value={sum((row) => row.activeFlags)} detail={`${sum((row) => row.archivedFlags)} archived`} />
        <StatTile
          label={`Changes, last ${DAYS} days`}
          value={recentChanges}
          detail={lastChange ? `Last change: ${formatWhen(lastChange.createdAt)}` : "No changes yet"}
        />
      </dl>

      <section className={styles.section}>
        <Text variant="heading">Projects</Text>
        <Table
          headers={["Project", "Key", "Environments", "Active flags", "Archived flags"]}
          isEmpty={projectRows.length === 0}
          emptyText="No projects yet."
        >
          {projectRows.map((project) => (
            <tr key={project.id}>
              <td>{project.name}</td>
              <td className={styles.key}>{project.key}</td>
              <td className={styles.number}>{project._count.environments}</td>
              <td className={styles.number}>{project.activeFlags}</td>
              <td className={styles.number}>{project.archivedFlags}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section className={styles.section}>
        <Text variant="heading">Teams</Text>
        <Table headers={["Team", "Members"]} isEmpty={teams.length === 0} emptyText="No teams yet.">
          {teams.map((team) => (
            <tr key={team.id}>
              <td>{team.name}</td>
              <td className={styles.number}>{team._count.members}</td>
            </tr>
          ))}
        </Table>
      </section>
    </>
  );
}
