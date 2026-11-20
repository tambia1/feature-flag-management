"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/types";
import { Button } from "@/app/_components/Button";
import { ConfirmAction } from "@/app/_components/ConfirmAction";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { maskSdkKey } from "@/lib/sdk-key";
import { deleteEnvironment, renameEnvironment, rotateSdkKey } from "../actions";
import styles from "./EnvironmentRow.module.css";

type Props = {
  environment: { id: string; name: string; key: string; sdkKey: string };
};

export const EnvironmentRow = ({ environment }: Props) => {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, formAction, isPending] = useActionState(async (previous: FormState, formData: FormData) => {
    const result = await renameEnvironment(previous, formData);
    if (!result.error) setEditing(false);
    return result;
  }, {});
  const formId = `environment-${environment.id}`;

  const copy = async () => {
    await navigator.clipboard.writeText(environment.sdkKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <tr>
      <td>
        {editing ? (
          <>
            <form id={formId} action={formAction}>
              <input type="hidden" name="environmentId" value={environment.id} />
            </form>
            <Input
              form={formId}
              name="name"
              compact
              aria-label="Environment name"
              required
              defaultValue={state.values?.name ?? environment.name}
            />
            <Message text={state.error} state="error" />
          </>
        ) : (
          environment.name
        )}
      </td>
      <td className={styles.mono}>{environment.key}</td>
      <td className={styles.sdk}>
        <span className={styles.mono}>{maskSdkKey(environment.sdkKey)}</span>
        <span aria-hidden="true"> · </span>
        <Button variant="link" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        {editing && (
          <>
            <span aria-hidden="true"> · </span>
            <ConfirmAction
              action={rotateSdkKey}
              fields={{ environmentId: environment.id }}
              triggerLabel="Rotate"
              title="Rotate environment SDK key?"
              text={`A new key is created for ${environment.name}.\nApps using the old key stop getting flags.`}
              confirmLabel="Rotate key"
            />
          </>
        )}
      </td>
      <td className={styles.actions}>
        {editing ? (
          <>
            <Button key="save" type="submit" form={formId} variant="link" disabled={isPending}>
              Save
            </Button>
            <span aria-hidden="true"> · </span>
            <Button variant="link" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button key="edit" variant="link" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <span aria-hidden="true"> · </span>
            <ConfirmAction
              action={deleteEnvironment}
              fields={{ environmentId: environment.id }}
              triggerLabel="Delete"
              triggerColor="danger"
              title="Delete environment?"
              text={`Delete "${environment.name}"? Its flag settings and environment SDK key are removed. Apps using its key stop getting flags.`}
              confirmLabel="Delete"
            />
          </>
        )}
      </td>
    </tr>
  );
};
