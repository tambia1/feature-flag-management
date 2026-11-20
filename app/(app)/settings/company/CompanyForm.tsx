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
  slackWebhookUrl: string | null;
};

export const CompanyForm = ({ name, slackWebhookUrl }: Props) => {
  const [state, formAction, isPending] = useActionState(updateCompany, {});

  return (
    <form action={formAction} className={styles.form}>
      <Field label="Company name">
        <Input name="name" required maxLength={100} defaultValue={state.values?.name ?? name} />
      </Field>
      <Field label="Slack webhook URL">
        <Input
          name="slackWebhookUrl"
          maxLength={500}
          autoComplete="off"
          spellCheck={false}
          placeholder="https://hooks.slack.com/services/…"
          defaultValue={state.values?.slackWebhookUrl ?? slackWebhookUrl ?? ""}
        />
      </Field>
      <Message text={state.error} state="error" />
      <Message text={state.success} state="success" />
      <div>
        <Button type="submit" variant="solid" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
};
