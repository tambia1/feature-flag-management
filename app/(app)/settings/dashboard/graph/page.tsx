import type { Metadata } from "next";
import { getCompanyActivity } from "@/lib/companies";
import { requireCompanyAdmin } from "@/lib/session";
import { ActivityChart } from "./ActivityChart";

export const metadata: Metadata = { title: "Dashboard graph" };

export default async function DashboardGraphPage() {
  const { companyId } = await requireCompanyAdmin();

  return <ActivityChart activity={await getCompanyActivity(companyId)} />;
}
