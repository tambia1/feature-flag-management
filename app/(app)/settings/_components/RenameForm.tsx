"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/types";
import { Button } from "@/app/_components/Button";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import styles from "./RenameForm.module.css";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  idName: string;
  id: string;
  value: string;
  label: string;
};

export const RenameForm = ({ action, idName, id, value, label }: Props) => {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(async (previous: FormState, formData: FormData) => {
    const result = await action(previous, formData);
    if (!result.error) setEditing(false);
    return result;
  }, {});

  if (!editing) {
    return (
      <div className={styles.title}>
        <h2 className={styles.name}>{value}</h2>
        <Button variant="link" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name={idName} value={id} />
      <Input name="name" aria-label={label} required maxLength={100} defaultValue={state.values?.name ?? value} compact />
      <Button type="submit" variant="secondary" disabled={isPending}>
        Save
      </Button>
      <Button variant="link" onClick={() => setEditing(false)}>
        Cancel
      </Button>
      <Message text={state.error} state="error" />
    </form>
  );
};
