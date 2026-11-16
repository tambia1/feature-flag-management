import type { Metadata } from "next";
import { getCompany, getCompanyActivity } from "@/lib/companies";
import { ActivityChart } from "./ActivityChart";

export const metadata: Metadata = { title: "Company graph" };

export default async function CompanyGraphPage({ params }: PageProps<"/platform/companies/[companyId]/graph">) {
  const { companyId } = await params;
  const company = await getCompany(companyId);

  return <ActivityChart activity={await getCompanyActivity(company.id)} />;
}
