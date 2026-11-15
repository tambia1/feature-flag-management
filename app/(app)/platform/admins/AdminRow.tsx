"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/types";
import { Button } from "@/app/_components/Button";
import { ConfirmAction } from "@/app/_components/ConfirmAction";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { PasswordField } from "../../_components/PasswordField";
import { removePlatformAdmin, updatePlatformAdmin } from "../actions";
import styles from "./AdminRow.module.css";

type Props = {
  admin: { id: string; name: string; email: string };
  added: string;
  isSelf: boolean;
};

export const AdminRow = ({ admin, added, isSelf }: Props) => {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(async (previous: FormState, formData: FormData) => {
    const result = await updatePlatformAdmin(previous, formData);
    if (!result.error) setEditing(false);
    return result;
  }, {});
  const formId = `admin-${admin.id}`;

  if (!editing) {
    return (
      <tr>
        <td>
          {admin.name}
          {isSelf && <span className={styles.muted}> (you)</span>}
        </td>
        <td>{admin.email}</td>
        <td className={styles.muted}>••••••••</td>
        <td>{added}</td>
        <td className={styles.actions}>
          <Button variant="link" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <span aria-hidden="true"> · </span>
          <ConfirmAction
            action={removePlatformAdmin}
            fields={{ userId: admin.id }}
            triggerLabel="Delete"
            title="Remove platform admin?"
            text={`Remove ${admin.name} (${admin.email})? They are logged out right away.`}
            confirmLabel="Remove"
            disabled={isSelf}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td>
        <form id={formId} action={formAction}>
          <input type="hidden" name="userId" value={admin.id} />
        </form>
        <Input form={formId} name="name" compact aria-label="Name" required defaultValue={state.values?.name ?? admin.name} />
      </td>
      <td>
        <Input
          form={formId}
          name="email"
          type="email"
          compact
          aria-label="Email"
          required
          defaultValue={state.values?.email ?? admin.email}
        />
      </td>
      <td>
        <PasswordField name="password" label="New password" placeholder="empty = keep current" compact form={formId} />
        <Message text={state.error} state="error" />
      </td>
      <td>{added}</td>
      <td className={styles.actions}>
        <Button type="submit" form={formId} variant="link" disabled={isPending}>
          Save
        </Button>
        <span aria-hidden="true"> · </span>
        <Button variant="link" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </td>
    </tr>
  );
};
