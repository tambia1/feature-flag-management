"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./FlagTabs.module.css";

type Props = {
  tabs: { href: string; label: string }[];
};

export const FlagTabs = ({ tabs }: Props) => {
  const pathname = usePathname();
  const env = useSearchParams().get("env");

  return (
    <nav className={styles.tabs} aria-label="Flag">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={env ? `${tab.href}?env=${env}` : tab.href}
          className={styles.tab}
          aria-current={pathname === tab.href ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
};
