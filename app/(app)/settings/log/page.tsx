import type { Metadata } from "next";
import { requireCompanyAdmin } from "@/lib/session";
import { LogView } from "../../_components/LogView";
import { Page } from "../../_components/Page";

export const metadata: Metadata = { title: "Company log" };

export default async function CompanyLogPage({ searchParams }: PageProps<"/settings/log">) {
  const admin = await requireCompanyAdmin();

  return (
    <Page title="Company log" subtitle="Read-only — nobody can edit or delete entries.">
      <LogView companyId={admin.companyId} query={await searchParams} defaultDays={7} />
    </Page>
  );
}
