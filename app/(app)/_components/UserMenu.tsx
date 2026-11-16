import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { logout } from "../actions";
import { CompanyIcon } from "./CompanyIcon";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./UserMenu.module.css";

type Props = {
  name: string;
  companyName: string;
  companyIconUrl: string | null;
};

export const UserMenu = ({ name, companyName, companyIconUrl }: Props) => {
  return (
    <details className={styles.menu}>
      <summary className={styles.trigger}>
        <CompanyIcon name={companyName} url={companyIconUrl} size="small" />
        {name.split(" ")[0]} ({companyName}) <ChevronDown size={14} />
      </summary>
      <div className={styles.panel}>
        <Link href="/account/password" className={styles.item}>
          Change password
        </Link>
        <Link href="/account/roles" className={styles.item}>
          My teams & roles
        </Link>
        <ThemeToggle className={styles.item} />
        <form action={logout}>
          <button type="submit" className={styles.item}>
            Log out
          </button>
        </form>
      </div>
    </details>
  );
};
