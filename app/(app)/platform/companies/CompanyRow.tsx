"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/types";
import { Button } from "@/app/_components/Button";
import { ConfirmAction } from "@/app/_components/ConfirmAction";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { deleteCompany, renameCompany } from "../actions";
import styles from "./CompanyRow.module.css";

type Props = {
  company: { id: string; name: string; isPlatform: boolean };
  admins: string;
  users: number;
  projects: number;
  flags: number;
  created: string;
};

export const CompanyRow = ({ company, admins, users, projects, flags, created }: Props) => {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(async (previous: FormState, formData: FormData) => {
    const result = await renameCompany(previous, formData);
    if (!result.error) setEditing(false);
    return result;
  }, {});
  const formId = `company-${company.id}`;

  return (
    <tr>
      <td>
        {editing ? (
          <>
            <form id={formId} action={formAction}>
              <input type="hidden" name="companyId" value={company.id} />
            </form>
            <Input form={formId} name="name" compact aria-label="Company name" required defaultValue={state.values?.name ?? company.name} />
            <Message text={state.error} state="error" />
          </>
        ) : (
          <>
            {company.name}
            {company.isPlatform && <span className={styles.muted}> (platform)</span>}
          </>
        )}
      </td>
      <td>{admins}</td>
      <td>{users}</td>
      <td>{projects}</td>
      <td>{flags}</td>
      <td>{created}</td>
      <td className={styles.actions}>
        {editing ? (
          <>
            <Button key="save" type="submit" form={formId} variant="link" disabled={isPending}>
              Save
            </Button>
            <span aria-hidden="true"> · </span>
            <Button variant="link" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button key="edit" variant="link" onClick={() => setEditing(true)}>
              Edit
            </Button>
            {!company.isPlatform && (
              <>
                <span aria-hidden="true"> · </span>
                <ConfirmAction
                  action={deleteCompany}
                  fields={{ companyId: company.id }}
                  triggerLabel="Delete"
                  title="Delete company"
                  text={`This deletes "${company.name}" with its ${users} users and ${projects} projects, and all their flags.\nThis can't be undone.`}
                  confirmLabel="Delete company"
                  typeToConfirm={company.name}
                />
              </>
            )}
          </>
        )}
      </td>
    </tr>
  );
};
