"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/types";
import { Button } from "@/app/_components/Button";
import { Field } from "@/app/_components/Field";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import styles from "./CreateNameForm.module.css";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  label: string;
  placeholder: string;
  submitLabel: string;
  /** Hidden fields sent along, e.g. the project id. */
  fields?: Record<string, string>;
  /** Also ask for a key (used in code), filled from the name. */
  withKey?: { label: string; placeholder: string };
};

/** "Add team" / "Add project" / "Add environment": a name (and key) plus a submit button. */
export const CreateNameForm = ({ action, label, placeholder, submitLabel, fields = {}, withKey }: Props) => {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className={styles.form}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className={styles.fields}>
        <Field label={label}>
          <Input
            name="name"
            required
            maxLength={100}
            placeholder={placeholder}
            defaultValue={state.values?.name}
            onChange={(event) => {
              const keyInput = event.currentTarget.form?.elements.namedItem("key") as HTMLInputElement | null;
              if (keyInput && !keyInput.dataset.touched) {
                keyInput.value = event.target.value
                  .toLowerCase()
                  .trim()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "");
              }
            }}
          />
        </Field>
        {withKey && (
          <Field label={withKey.label}>
            <Input
              name="key"
              required
              maxLength={64}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder={withKey.placeholder}
              defaultValue={state.values?.key}
              onInput={(event) => (event.currentTarget.dataset.touched = "true")}
            />
          </Field>
        )}
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Adding…" : submitLabel}
        </Button>
      </div>
      <Message text={state.error} state="error" />
    </form>
  );
};
