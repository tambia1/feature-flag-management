"use client";

import { useActionState } from "react";
import { Button } from "@/app/_components/Button";
import { Field } from "@/app/_components/Field";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { login } from "./actions";
import styles from "./LoginForm.module.css";

export const LoginForm = () => {
  const [state, formAction, isPending] = useActionState(login, {});

  return (
    <form action={formAction} className={styles.form}>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Message text={state.error} state="error" />
      <Button type="submit" variant="primary" disabled={isPending}>
        {isPending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
};
