import { getAccessibleProjects } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { Header } from "./_components/Header";
import { SideMenu } from "./_components/SideMenu";
import styles from "./layout.module.css";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const projects = await getAccessibleProjects(user);

  return (
    <div className={styles.shell}>
      <a href="#content" className={styles.skipLink}>
        Skip to content
      </a>
      <Header user={user} projects={projects} />
      <SideMenu user={user} projects={projects} />
      <main id="content" className={styles.content}>
        {children}
      </main>
    </div>
  );
}
