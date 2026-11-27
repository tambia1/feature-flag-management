import type { Metadata } from "next";
import { Table } from "@/app/_components/Table";
import { formatMonth } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/session";
import { Card } from "../../_components/Card";
import { Page } from "../../_components/Page";
import { RefreshWhile } from "../../_components/RefreshWhile";
import { AddCompanyForm } from "./AddCompanyForm";
import { CompanyRow } from "./CompanyRow";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage() {
  await requirePlatformAdmin();

  const companies = await prisma.company.findMany({
    orderBy: [{ isPlatform: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      isPlatform: true,
      iconThumbUrl: true,
      iconStatus: true,
      createdAt: true,
      users: { where: { role: "ADMIN" }, select: { name: true }, orderBy: { createdAt: "asc" } },
      _count: { select: { users: true, projects: true } },
      projects: { select: { _count: { select: { flags: { where: { archivedAt: null } } } } } },
    },
  });

  return (
    <Page title="Companies">
      <RefreshWhile active={companies.some((company) => company.iconStatus === "PROCESSING")} intervalMs={2000} />
      <Card title="Add company">
        <AddCompanyForm />
      </Card>
      <Table headers={["Name", "Admins", "Users", "Projects", "Flags", "Created", ""]} isEmpty={companies.length === 0} editable>
        {companies.map((company) => (
          <CompanyRow
            key={company.id}
            company={{
              id: company.id,
              name: company.name,
              isPlatform: company.isPlatform,
              iconThumbUrl: company.iconThumbUrl,
              iconStatus: company.iconStatus,
            }}
            admins={company.users.map((user) => user.name.split(" ")[0]).join(", ") || "—"}
            users={company._count.users}
            projects={company._count.projects}
            flags={company.projects.reduce((sum, project) => sum + project._count.flags, 0)}
            created={formatMonth(company.createdAt)}
          />
        ))}
      </Table>
    </Page>
  );
}
