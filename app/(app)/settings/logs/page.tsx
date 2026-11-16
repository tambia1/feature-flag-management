import type { Metadata } from "next";
import { requireCompanyAdmin } from "@/lib/session";
import { Page } from "../../_components/Page";
import { LogsView } from "./LogsView";

export const metadata: Metadata = { title: "Logs" };

export default async function LogsPage({ searchParams }: PageProps<"/settings/logs">) {
  const admin = await requireCompanyAdmin();

  return (
    <Page title="Logs">
      <LogsView companyId={admin.companyId} query={await searchParams} defaultDays={7} />
    </Page>
  );
}
