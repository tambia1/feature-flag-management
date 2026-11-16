"use client";

import { useActionState, useRef } from "react";
import type { FormAction, FormState } from "@/app/types";
import { Button } from "@/app/_components/Button";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { MAX_ICON_BYTES } from "@/lib/uploads";
import { CompanyIcon } from "../../_components/CompanyIcon";
import styles from "./CompanyIconForm.module.css";

type Props = {
  name: string;
  iconUrl: string | null;
  uploadAction: FormAction;
  removeAction: FormAction;
  fields?: Record<string, string>;
};

export const CompanyIconForm = ({ name, iconUrl, uploadAction, removeAction, fields = {} }: Props) => {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, uploadFormAction, isUploading] = useActionState(async (previous: FormState, formData: FormData) => {
    const file = formData.get("icon");
    if (file instanceof File && file.size > MAX_ICON_BYTES) {
      return { error: "The image must be 20 MB or smaller" };
    }
    return uploadAction(previous, formData);
  }, {});
  const [removeState, removeFormAction, isRemoving] = useActionState(removeAction, {});
  const isBusy = isUploading || isRemoving;

  return (
    <form ref={formRef} action={uploadFormAction} className={styles.section}>
      {Object.entries(fields).map(([fieldName, value]) => (
        <input key={fieldName} type="hidden" name={fieldName} value={value} />
      ))}
      <CompanyIcon name={name} url={iconUrl} size="large" />
      <div className={styles.details}>
        <Input
          ref={inputRef}
          type="file"
          name="icon"
          accept="image/*"
          hidden
          onChange={(event) => {
            if (event.target.files?.length) formRef.current?.requestSubmit();
          }}
        />
        <div className={styles.buttons}>
          <Button variant="link" disabled={isBusy} onClick={() => inputRef.current?.click()}>
            {isUploading ? "Uploading…" : iconUrl ? "Change icon" : "Upload icon"}
          </Button>
          {iconUrl && (
            <Button type="submit" variant="link" formAction={removeFormAction} formNoValidate disabled={isBusy}>
              {isRemoving ? "Removing…" : "Remove icon"}
            </Button>
          )}
        </div>
        <Message text={state.error ?? removeState.error} state="error" />
      </div>
    </form>
  );
};
