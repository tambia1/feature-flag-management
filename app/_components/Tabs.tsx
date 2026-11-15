"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./Tabs.module.css";

type Props = {
  label: string;
  tabs: { href: string; label: string }[];
  keepParams?: string[];
};

export const Tabs = ({ label, tabs, keepParams = [] }: Props) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const kept = new URLSearchParams();
  for (const name of keepParams) {
    const value = searchParams.get(name);
    if (value) kept.set(name, value);
  }
  const query = kept.size > 0 ? `?${kept}` : "";

  return (
    <nav className={styles.tabs} aria-label={label}>
      {tabs.map((tab) => (
        <Link key={tab.href} href={`${tab.href}${query}`} className={styles.tab} aria-current={pathname === tab.href ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
};
