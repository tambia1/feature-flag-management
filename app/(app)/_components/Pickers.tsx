"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AccessibleProject } from "@/lib/permissions";
import { isProduction, projectKeyFromPath } from "@/lib/environments";
import styles from "./Pickers.module.css";

type Props = {
  projects: AccessibleProject[];
};

/** Project + environment pickers. They apply to every flag page and list only what you can access. */
export const Pickers = ({ projects }: Props) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const projectKey = projectKeyFromPath(pathname);
  const project = projects.find((item) => item.key === projectKey);

  if (!project) {
    return <div className={styles.pickers} />;
  }

  const environment = project.environments.find((item) => item.key === searchParams.get("env")) ?? project.environments[0];

  const changeEnvironment = (key: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("env", key);
    router.push(`${pathname}?${params}`);
  };

  return (
    <div className={styles.pickers}>
      <label className={styles.picker}>
        <span className={styles.label}>Project:</span>
        <select className={styles.select} value={project.key} onChange={(event) => router.push(`/projects/${event.target.value}/flags`)}>
          {projects.map((item) => (
            <option key={item.id} value={item.key}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className={`${styles.picker} ${isProduction(environment) ? styles.production : ""}`}>
        <span className={styles.label}>Environment:</span>
        <select className={styles.select} value={environment.key} onChange={(event) => changeEnvironment(event.target.value)}>
          {project.environments.map((item) => (
            <option key={item.id} value={item.key}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};
