import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Tabs } from "@/app/_components/Tabs";
import { getFlagByKey, getProjectContext } from "@/lib/flags/context";
import { requireUser } from "@/lib/session";
import { NoAccess } from "../../../../_components/NoAccess";
import styles from "./layout.module.css";
import { Text } from "@/app/_components/Text";

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
        <ArrowLeft size={14} /> {flag.archivedAt ? "Archived flags" : "Flags"}
      </Link>
      <div className={styles.title}>
        <h1 className={styles.key}>{flag.key}</h1>
        <Text variant="plain" color="muted">
          {flag.name}
        </Text>
        {flag.archivedAt && <span className={styles.badge}>Archived</span>}
      </div>
      <Tabs
        label="Flag"
        keepParams={["env"]}
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
