"use client";

import { ReactNode, useActionState, useState } from "react";
import type { FormState } from "@/app/types";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Field } from "./Field";
import { Input } from "./Input";
import { Message } from "./Message";
import styles from "./ConfirmAction.module.css";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** Hidden form fields sent with the action, such as the id. */
  fields: Record<string, string>;
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary" | "danger" | "link";
  title: string;
  text: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** Type-to-confirm: the confirm button stays disabled until this is typed. */
  typeToConfirm?: string;
  /** Ask for a comment, saved to the log. */
  withComment?: boolean;
  disabled?: boolean;
};

/** A button that opens a confirm dialog, then runs a Server Action. */
export const ConfirmAction = ({
  action,
  fields,
  triggerLabel,
  triggerVariant = "link",
  title,
  text,
  confirmLabel,
  danger = true,
  typeToConfirm,
  withComment = false,
  disabled = false,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, formAction, isPending] = useActionState(async (previous: FormState, formData: FormData) => {
    const result = await action(previous, formData);

    if (!result.error) {
      setOpen(false);
    }

    return result;
  }, {});

  return (
    <>
      <Button
        variant={triggerVariant}
        onClick={() => {
          setTyped("");
          setOpen(true);
        }}
        disabled={disabled}
      >
        {triggerLabel}
      </Button>
      <Dialog open={open} title={title} onClose={() => setOpen(false)}>
        <form action={formAction} className={styles.form}>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <div className={styles.text}>{text}</div>
          {typeToConfirm && (
            <Field label={`Type ${typeToConfirm} to confirm:`}>
              <Input value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
            </Field>
          )}
          {withComment && (
            <Field label="Comment (saved to the log)">
              <Input name="comment" maxLength={500} />
            </Field>
          )}
          <Message text={state.error} state="error" />
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={danger ? "danger" : "primary"}
              disabled={isPending || (typeToConfirm !== undefined && typed !== typeToConfirm)}
            >
              {isPending ? "Working…" : confirmLabel}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
};
