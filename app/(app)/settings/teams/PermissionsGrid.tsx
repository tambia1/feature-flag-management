"use client";

import { useActionState } from "react";
import { Button } from "@/app/_components/Button";
import { Message } from "@/app/_components/Message";
import { Select } from "@/app/_components/Select";
import { saveTeamPermissions } from "../actions";
import styles from "./PermissionsGrid.module.css";

type Props = {
  teamId: string;
  projects: { id: string; name: string; environments: { id: string; name: string }[] }[];
  /** environmentId → role; missing = none. */
  roles: Record<string, string>;
};

const ROLE_OPTIONS = [
  { value: "NONE", label: "none" },
  { value: "VIEWER", label: "viewer" },
  { value: "EDITOR", label: "editor" },
];

/** One role per environment for this team. Saved as a whole grid. */
export const PermissionsGrid = ({ teamId, projects, roles }: Props) => {
  const [state, formAction, isPending] = useActionState(saveTeamPermissions, {});

  if (projects.length === 0) {
    return <p className={styles.empty}>No projects yet. Add one on the Projects page.</p>;
  }

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="teamId" value={teamId} />
      <table className={styles.grid}>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <th scope="row" className={styles.project}>
                {project.name}
              </th>
              {project.environments.length === 0 && <td className={styles.empty}>No environments</td>}
              {project.environments.map((environment) => (
                <td key={environment.id}>
                  <label className={styles.cell}>
                    <span className={styles.environment}>{environment.name}</span>
                    <Select compact name={`role-${environment.id}`} defaultValue={roles[environment.id] ?? "NONE"} options={ROLE_OPTIONS} />
                  </label>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Message text={state.error} state="error" />
        <Message text={state.success} state="success" />
      </div>
    </form>
  );
};
