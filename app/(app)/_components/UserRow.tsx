"use client";

import { useActionState, useState } from "react";
import type { CompanyRole, FormAction, FormState } from "@/app/types";
import { Button } from "@/app/_components/Button";
import { ConfirmAction } from "@/app/_components/ConfirmAction";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { Select } from "@/app/_components/Select";
import { PasswordField } from "./PasswordField";
import { ROLE_OPTIONS } from "./userRoles";
import styles from "./UserRow.module.css";

type Props = {
  user: { id: string; name: string; email: string; role: CompanyRole };
  teams: string;
  isSelf: boolean;
  updateAction: FormAction;
  deleteAction: FormAction;
  fields?: Record<string, string>;
};

export const UserRow = ({ user, teams, isSelf, updateAction, deleteAction, fields = {} }: Props) => {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(async (previous: FormState, formData: FormData) => {
    const result = await updateAction(previous, formData);
    if (!result.error) setEditing(false);
    return result;
  }, {});
  const formId = `user-${user.id}`;

  if (!editing) {
    return (
      <tr>
        <td>
          {user.name}
          {isSelf && <span className={styles.you}> (you)</span>}
        </td>
        <td>{user.email}</td>
        <td>{user.role.toLowerCase()}</td>
        <td className={styles.muted}>••••••••</td>
        <td>{teams}</td>
        <td className={styles.actions}>
          <Button key="edit" variant="link" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <span aria-hidden="true"> · </span>
          <ConfirmAction
            action={deleteAction}
            fields={{ ...fields, userId: user.id }}
            triggerLabel="Delete"
            triggerColor="danger"
            title="Delete user?"
            text={`Delete ${user.name} (${user.email})?\nThey are logged out right away and lose all access.`}
            confirmLabel="Delete"
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
          <input type="hidden" name="userId" value={user.id} />
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        </form>
        <Input form={formId} name="name" compact aria-label="Name" required defaultValue={state.values?.name ?? user.name} />
      </td>
      <td>
        <Input
          form={formId}
          name="email"
          type="email"
          compact
          aria-label="Email"
          required
          defaultValue={state.values?.email ?? user.email}
        />
      </td>
      <td>
        <Select form={formId} name="role" compact aria-label="Role" defaultValue={state.values?.role ?? user.role} options={ROLE_OPTIONS} />
      </td>
      <td>
        <PasswordField name="password" label="New password" placeholder="empty = keep current" compact form={formId} />
      </td>
      <td>
        {teams}
        <Message text={state.error} state="error" />
      </td>
      <td className={styles.actions}>
        <Button key="save" type="submit" form={formId} variant="link" disabled={isPending}>
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
