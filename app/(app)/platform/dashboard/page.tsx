import type { Metadata } from "next";
import { Table } from "@/app/_components/Table";
import { formatMonth, formatWhen } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/session";
import { Page } from "../../_components/Page";
import { StatTile } from "./StatTile";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Dashboard" };

const DAYS = 30;

export default async function DashboardPage() {
  await requirePlatformAdmin();

  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  const [companies, recentChanges, lastChanges] = await Promise.all([
    prisma.company.findMany({
      where: { isPlatform: false },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        users: { select: { role: true, createdAt: true } },
        _count: { select: { teams: true } },
        projects: {
          select: {
            _count: { select: { environments: true, flags: { where: { archivedAt: null } } } },
          },
        },
      },
    }),
    prisma.log.groupBy({ by: ["companyId"], where: { createdAt: { gte: since } }, _count: true }),
    prisma.log.findMany({ distinct: ["companyId"], orderBy: { createdAt: "desc" }, select: { companyId: true, createdAt: true } }),
  ]);

  const rows = companies.map((company) => ({
    id: company.id,
    name: company.name,
    createdAt: company.createdAt,
    users: company.users.length,
    admins: company.users.filter((user) => user.role === "ADMIN").length,
    teams: company._count.teams,
    projects: company.projects.length,
    environments: company.projects.reduce((sum, project) => sum + project._count.environments, 0),
    flags: company.projects.reduce((sum, project) => sum + project._count.flags, 0),
    changes: recentChanges.find((row) => row.companyId === company.id)?._count ?? 0,
    lastChange: lastChanges.find((row) => row.companyId === company.id)?.createdAt ?? null,
  }));

  const total = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((sum, row) => sum + pick(row), 0);
  const newCompanies = rows.filter((row) => row.createdAt >= since).length;
  const newUsers = companies.reduce((sum, company) => sum + company.users.filter((user) => user.createdAt >= since).length, 0);
  const activeCompanies = rows.filter((row) => row.changes > 0).length;

  return (
    <Page title="Dashboard" subtitle="Customer companies, not counting our own.">
      <dl className={styles.tiles}>
        <StatTile label="Companies" value={rows.length} detail={`${newCompanies} new in the last ${DAYS} days`} />
        <StatTile label="Users" value={total((row) => row.users)} detail={`${newUsers} new in the last ${DAYS} days`} />
        <StatTile label="Projects" value={total((row) => row.projects)} detail={`${total((row) => row.environments)} environments`} />
        <StatTile label="Active flags" value={total((row) => row.flags)} detail="Not archived" />
        <StatTile
          label={`Changes, last ${DAYS} days`}
          value={total((row) => row.changes)}
          detail={`${activeCompanies} of ${rows.length} companies made changes`}
        />
      </dl>

      <section className={styles.section}>
        <h2 className={styles.heading}>Companies</h2>
        <Table
          headers={[
            "Company",
            "Since",
            "Users",
            "Admins",
            "Teams",
            "Projects",
            "Environments",
            "Active flags",
            `Changes (${DAYS} days)`,
            "Last change",
          ]}
          isEmpty={rows.length === 0}
          emptyText="No customer companies yet."
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td className={styles.muted}>{formatMonth(row.createdAt)}</td>
              <td className={styles.number}>{row.users}</td>
              <td className={styles.number}>{row.admins}</td>
              <td className={styles.number}>{row.teams}</td>
              <td className={styles.number}>{row.projects}</td>
              <td className={styles.number}>{row.environments}</td>
              <td className={styles.number}>{row.flags}</td>
              <td className={styles.number}>{row.changes}</td>
              <td className={styles.muted}>{row.lastChange ? formatWhen(row.lastChange) : "Never"}</td>
            </tr>
          ))}
        </Table>
      </section>
    </Page>
  );
}
