"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { SessionUser } from "@/app/types";
import type { AccessibleProject } from "@/lib/permissions";
import { projectKeyFromPath } from "@/lib/environments";
import styles from "./SideMenu.module.css";

type Props = {
  user: SessionUser;
  projects: AccessibleProject[];
};

type Section = {
  title: string;
  tone: "flags" | "settings";
  links: { href: string; label: string }[];
};

export const SideMenu = ({ user, projects }: Props) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const projectKey = projectKeyFromPath(pathname) ?? projects[0]?.key;
  const env = searchParams.get("env");
  const query = env ? `?env=${env}` : "";

  const sections: Section[] = [
    {
      title: "Flags",
      tone: "flags",
      links: projectKey
        ? [
            { href: `/projects/${projectKey}/flags${query}`, label: "Flags" },
            { href: `/projects/${projectKey}/archived${query}`, label: "Archived" },
          ]
        : [{ href: "/", label: "Flags" }],
    },
  ];

  if (user.role === "ADMIN") {
    sections.push({
      title: "Settings",
      tone: "settings",
      links: [
        { href: "/settings/company", label: "Company" },
        ...(user.isPlatformAdmin ? [{ href: "/platform/companies", label: "Companies" }] : []),
        { href: "/settings/users", label: "Users" },
        { href: "/settings/teams", label: "Teams" },
        { href: "/settings/projects", label: "Projects" },
        { href: "/settings/log", label: "Company log" },
      ],
    });
  }

  const isActive = (href: string) => {
    const path = href.split("?")[0];
    return path === "/"
      ? pathname === "/"
      : pathname === path || (path.endsWith("/flags") && pathname.startsWith(`${path}/`) && !pathname.endsWith("/new"));
  };

  return (
    <nav className={styles.menu} aria-label="Main">
      {sections.map((section) => (
        <div key={section.title} className={`${styles.section} ${styles[section.tone]}`}>
          <h2 className={styles.title}>{section.title}</h2>
          <ul>
            {section.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={styles.link} aria-current={isActive(link.href) ? "page" : undefined}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
};
