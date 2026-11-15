"use client";

import { useActionState } from "react";
import { Button } from "@/app/_components/Button";
import { Field } from "@/app/_components/Field";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { changePassword } from "../actions";
import styles from "./PasswordForm.module.css";

export const PasswordForm = () => {
  const [state, formAction, isPending] = useActionState(changePassword, {});

  return (
    <form action={formAction} className={styles.form}>
      <Field label="Current password">
        <Input name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password">
        <Input name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirm new password">
        <Input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Message text={state.error} state="error" />
      <Message text={state.success} state="success" />
      <div>
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Saving…" : "Save password"}
        </Button>
      </div>
    </form>
  );
};
