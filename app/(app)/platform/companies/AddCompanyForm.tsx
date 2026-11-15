"use client";

import { useActionState } from "react";
import { Button } from "@/app/_components/Button";
import { Field } from "@/app/_components/Field";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { PasswordField } from "../../_components/PasswordField";
import { createCompany } from "../actions";
import styles from "./AddCompanyForm.module.css";

export const AddCompanyForm = () => {
  const [state, formAction, isPending] = useActionState(createCompany, {});

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.fields}>
        <Field label="Company name">
          <Input name="name" required maxLength={100} defaultValue={state.values?.name} />
        </Field>
        <Field label="Admin name">
          <Input name="adminName" required maxLength={100} defaultValue={state.values?.adminName} />
        </Field>
        <Field label="Admin email">
          <Input name="adminEmail" type="email" required defaultValue={state.values?.adminEmail} />
        </Field>
        <Field label="Password">
          <PasswordField key={state.success} name="password" label="Password" required generateOnStart />
        </Field>
        <Button type="submit" variant="primary" disabled={isPending} className={styles.submit}>
          {isPending ? "Adding…" : "Add company"}
        </Button>
      </div>
      <Message text={state.error} state="error" />
      <Message text={state.success} state="success" />
    </form>
  );
};
