import type { Metadata } from "next";
import { formatMonth } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCompanyAdmin } from "@/lib/session";
import { Page } from "../../_components/Page";
import { CompanyForm } from "./CompanyForm";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Company" };

export default async function CompanyPage() {
  const admin = await requireCompanyAdmin();
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: admin.companyId },
    select: { name: true, createdAt: true, _count: { select: { projects: true, users: true } } },
  });

  return (
    <Page title="Company">
      <CompanyForm name={company.name} />
      <dl className={styles.facts}>
        <dt>Created</dt>
        <dd>{formatMonth(company.createdAt)}</dd>
        <dt>Usage</dt>
        <dd>
          {company._count.projects} projects · {company._count.users} users
        </dd>
      </dl>
    </Page>
  );
}
