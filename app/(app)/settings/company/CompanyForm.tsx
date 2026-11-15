"use client";

import { useActionState } from "react";
import { Button } from "@/app/_components/Button";
import { Field } from "@/app/_components/Field";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { updateCompany } from "../actions";
import styles from "./CompanyForm.module.css";

type Props = {
  name: string;
};

export const CompanyForm = ({ name }: Props) => {
  const [state, formAction, isPending] = useActionState(updateCompany, {});

  return (
    <form action={formAction} className={styles.form}>
      <Field label="Company name">
        <Input name="name" required maxLength={100} defaultValue={state.values?.name ?? name} />
      </Field>
      <Message text={state.error} state="error" />
      <Message text={state.success} state="success" />
      <div>
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
};
