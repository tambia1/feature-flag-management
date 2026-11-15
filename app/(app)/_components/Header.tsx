import Link from "next/link";
import type { SessionUser } from "@/app/types";
import type { AccessibleProject } from "@/lib/permissions";
import { Pickers } from "./Pickers";
import { UserMenu } from "./UserMenu";
import styles from "./Header.module.css";

type Props = {
  user: SessionUser;
  projects: AccessibleProject[];
};

export const Header = ({ user, projects }: Props) => {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>
        <span aria-hidden="true">⚑</span> Feature Flag Management
      </Link>
      <Pickers projects={projects} />
      <UserMenu name={user.name} companyName={user.companyName} />
    </header>
  );
};
