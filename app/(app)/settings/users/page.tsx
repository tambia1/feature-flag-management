import type { Metadata } from "next";
import { Table } from "@/app/_components/Table";
import { searchString } from "@/lib/flags/context";
import { prisma } from "@/lib/prisma";
import { requireCompanyAdmin } from "@/lib/session";
import { ListFilters } from "../../_components/ListFilters";
import { Card } from "../../_components/Card";
import { Page } from "../../_components/Page";
import { AddUserForm } from "../../_components/AddUserForm";
import { UserRow } from "../../_components/UserRow";
import { createUser, deleteUser, updateUser } from "../actions";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/settings/users">) {
  const admin = await requireCompanyAdmin();
  const search = searchString((await searchParams).search).trim();

  const users = await prisma.user.findMany({
    where: {
      companyId: admin.companyId,
      ...(search && {
        OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }],
      }),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, teamMembers: { select: { team: { select: { name: true } } } } },
  });

  return (
    <Page title="Users">
      <Card title="Add user">
        <AddUserForm action={createUser} />
      </Card>
      <ListFilters withStatus={false} placeholder="Search by name or email" />
      <Table
        headers={["Name", "Email", "Role", "Password", "Teams", ""]}
        isEmpty={users.length === 0}
        emptyText="No users match your search."
        editable
      >
        {users.map((user) => (
          <UserRow
            key={user.id}
            user={{ id: user.id, name: user.name, email: user.email, role: user.role }}
            teams={user.teamMembers.map((member) => member.team.name).join(", ") || "—"}
            isSelf={user.id === admin.id}
            updateAction={updateUser}
            deleteAction={deleteUser}
          />
        ))}
      </Table>
    </Page>
  );
}
