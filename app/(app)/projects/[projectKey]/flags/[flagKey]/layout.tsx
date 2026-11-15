import Link from "next/link";
import { getFlagByKey, getProjectContext } from "@/lib/flags/context";
import { requireUser } from "@/lib/session";
import { NoAccess } from "../../../../_components/NoAccess";
import { FlagTabs } from "./_components/FlagTabs";
import styles from "./layout.module.css";

export default async function FlagLayout({ params, children }: LayoutProps<"/projects/[projectKey]/flags/[flagKey]">) {
  const { projectKey, flagKey } = await params;
  const user = await requireUser();
  const context = await getProjectContext(user, projectKey);

  if (!context) {
    return <NoAccess />;
  }

  const flag = await getFlagByKey(context.project.id, flagKey);
  const base = `/projects/${projectKey}/flags/${flagKey}`;

  return (
    <div className={styles.flag}>
      <Link href={`/projects/${projectKey}/${flag.archivedAt ? "archived" : "flags"}`} className={styles.back}>
        ← {flag.archivedAt ? "Archived flags" : "Flags"}
      </Link>
      <div className={styles.title}>
        <h1 className={styles.key}>{flag.key}</h1>
        <span className={styles.name}>{flag.name}</span>
        {flag.archivedAt && <span className={styles.badge}>Archived</span>}
      </div>
      <FlagTabs
        tabs={[
          { href: base, label: "Targeting" },
          { href: `${base}/history`, label: "History" },
          { href: `${base}/settings`, label: "Settings" },
        ]}
      />
      {children}
    </div>
  );
}
