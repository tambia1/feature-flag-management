import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Table } from "@/app/_components/Table";
import { searchString } from "@/lib/flags/context";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/session";
import { AddUserForm } from "../../../_components/AddUserForm";
import { Card } from "../../../_components/Card";
import { ListFilters } from "../../../_components/ListFilters";
import { Page } from "../../../_components/Page";
import { UserRow } from "../../../_components/UserRow";
import { createCompanyUser, deleteCompanyUser, updateCompanyUser } from "../../actions";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Company users" };

export default async function CompanyUsersPage({ params, searchParams }: PageProps<"/platform/companies/[companyId]">) {
  const admin = await requirePlatformAdmin();
  const { companyId } = await params;
  const search = searchString((await searchParams).search).trim();

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });

  if (!company) {
    notFound();
  }

  const users = await prisma.user.findMany({
    where: {
      companyId: company.id,
      ...(search && {
        OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }],
      }),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, teamMembers: { select: { team: { select: { name: true } } } } },
  });
  const fields = { companyId: company.id };

  return (
    <div className={styles.company}>
      <Link href="/platform/companies" className={styles.back}>
        <ArrowLeft size={14} /> Companies
      </Link>
      <Page title={company.name} subtitle="Users">
        <Card title="Add user">
          <AddUserForm action={createCompanyUser} fields={fields} />
        </Card>
        <ListFilters withStatus={false} placeholder="Search by name or email" />
        <Table
          headers={["Name", "Email", "Role", "Password", "Teams", ""]}
          isEmpty={users.length === 0}
          emptyText="No users match your search."
        >
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={{ id: user.id, name: user.name, email: user.email, role: user.role }}
              teams={user.teamMembers.map((member) => member.team.name).join(", ") || "—"}
              isSelf={user.id === admin.id}
              updateAction={updateCompanyUser}
              deleteAction={deleteCompanyUser}
              fields={fields}
            />
          ))}
        </Table>
      </Page>
    </div>
  );
}
