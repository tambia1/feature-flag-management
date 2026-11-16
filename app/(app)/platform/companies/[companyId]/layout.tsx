import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Tabs } from "@/app/_components/Tabs";
import { getCompany } from "@/lib/companies";
import { formatMonth } from "@/lib/format";
import styles from "./layout.module.css";

export default async function CompanyLayout({ params, children }: LayoutProps<"/platform/companies/[companyId]">) {
  const { companyId } = await params;
  const company = await getCompany(companyId);
  const base = `/platform/companies/${company.id}`;

  return (
    <div className={styles.company}>
      <Link href="/platform/companies" className={styles.back}>
        <ArrowLeft size={14} /> Companies
      </Link>
      <div className={styles.title}>
        <h1 className={styles.name}>{company.name}</h1>
        <span className={styles.since}>
          {company.isPlatform ? "Our own company" : "Customer"} since {formatMonth(company.createdAt)}
        </span>
      </div>
      <Tabs
        label="Company"
        tabs={[
          { href: base, label: "Statistics" },
          { href: `${base}/graph`, label: "Graph" },
        ]}
      />
      {children}
    </div>
  );
}
