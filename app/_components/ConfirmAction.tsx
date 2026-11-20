"use client";

import { ReactNode, useActionState, useState } from "react";
import type { FormState } from "@/app/types";
import { Button, type ButtonColor, type ButtonVariant } from "./Button";
import { Dialog } from "./Dialog";
import { Field } from "./Field";
import { Input } from "./Input";
import { Message } from "./Message";
import styles from "./ConfirmAction.module.css";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  triggerLabel: string;
  triggerVariant?: Exclude<ButtonVariant, "plain">;
  triggerColor?: ButtonColor;
  title: string;
  text: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  withComment?: boolean;
  disabled?: boolean;
};

export const ConfirmAction = ({
  action,
  fields,
  triggerLabel,
  triggerVariant = "link",
  triggerColor = "accent",
  title,
  text,
  confirmLabel,
  danger = true,
  withComment = false,
  disabled = false,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(async (previous: FormState, formData: FormData) => {
    const result = await action(previous, formData);

    if (!result.error) {
      setOpen(false);
    }

    return result;
  }, {});

  return (
    <>
      <Button variant={triggerVariant} color={triggerColor} onClick={() => setOpen(true)} disabled={disabled}>
        {triggerLabel}
      </Button>
      <Dialog open={open} title={title} onClose={() => setOpen(false)}>
        <form action={formAction} className={styles.form}>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <div className={styles.text}>{text}</div>
          {withComment && (
            <Field label="Comment (saved to the log)">
              <Input name="comment" maxLength={500} />
            </Field>
          )}
          <Message text={state.error} state="error" />
          <div className={styles.actions}>
            <Button variant="outline" color="neutral" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="solid" color={danger ? "danger" : "accent"} disabled={isPending}>
              {isPending ? "Working…" : confirmLabel}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
};
