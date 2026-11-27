"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/types";
import { Button } from "@/app/_components/Button";
import { Field } from "@/app/_components/Field";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { PasswordField } from "../../_components/PasswordField";
import { uploadIconField } from "../../_components/uploadIcon";
import { createCompany, startCompanyIconUpload } from "../actions";
import { IconField } from "./IconField";
import styles from "./AddCompanyForm.module.css";

export const AddCompanyForm = () => {
  const [state, formAction, isPending] = useActionState(async (previous: FormState, formData: FormData) => {
    const error = await uploadIconField(formData, startCompanyIconUpload);
    if (error) return { ...previous, error, success: undefined };
    return createCompany(previous, formData);
  }, {});

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.fields}>
        <IconField key={state.success} />
        <Field label="Company name">
          <Input name="name" required maxLength={100} defaultValue={state.values?.name} />
        </Field>
        <Field label="Admin name">
          <Input name="adminName" required maxLength={100} defaultValue={state.values?.adminName} />
        </Field>
        <Field label="Admin email">
          <Input name="adminEmail" type="email" required defaultValue={state.values?.adminEmail} />
        </Field>
        <Field label="Admin password">
          <PasswordField key={state.success} name="password" label="Admin password" required />
        </Field>
        <Button type="submit" variant="solid" disabled={isPending} className={styles.submit}>
          {isPending ? "Adding…" : "Add company"}
        </Button>
      </div>
      <Message text={state.error} state="error" />
      <Message text={state.success} state="success" />
    </form>
  );
};
