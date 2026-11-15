"use client";

import { useActionState } from "react";
import { Button } from "@/app/_components/Button";
import { Field } from "@/app/_components/Field";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { Select } from "@/app/_components/Select";
import { PasswordField } from "../../_components/PasswordField";
import { createUser } from "../actions";
import { ROLE_OPTIONS } from "./roles";
import styles from "./AddUserForm.module.css";

export const AddUserForm = () => {
  const [state, formAction, isPending] = useActionState(createUser, {});

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.fields}>
        <Field label="Name">
          <Input name="name" required maxLength={100} defaultValue={state.values?.name} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required defaultValue={state.values?.email} />
        </Field>
        <Field label="Role">
          <Select name="role" defaultValue={state.values?.role ?? "MEMBER"} options={ROLE_OPTIONS} />
        </Field>
        <Field label="Password">
          <PasswordField key={state.success} name="password" label="Password" required />
        </Field>
        <Button type="submit" variant="primary" disabled={isPending} className={styles.submit}>
          {isPending ? "Adding…" : "Add user"}
        </Button>
      </div>
      <Message text={state.error} state="error" />
      <Message text={state.success} state="success" />
    </form>
  );
};
