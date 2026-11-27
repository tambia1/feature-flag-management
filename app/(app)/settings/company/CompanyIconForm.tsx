"use client";

import { useActionState, useRef } from "react";
import type { FileUpload, FormAction, FormState, IconStatus } from "@/app/types";
import { Button } from "@/app/_components/Button";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { CompanyIcon } from "../../_components/CompanyIcon";
import { RefreshWhile } from "../../_components/RefreshWhile";
import { uploadIconField } from "../../_components/uploadIcon";
import styles from "./CompanyIconForm.module.css";

type Props = {
  name: string;
  iconUrl: string | null;
  iconStatus: IconStatus | null;
  startUpload: () => Promise<FileUpload>;
  uploadAction: FormAction;
  removeAction: FormAction;
  fields?: Record<string, string>;
};

export const CompanyIconForm = ({ name, iconUrl, iconStatus, startUpload, uploadAction, removeAction, fields = {} }: Props) => {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, uploadFormAction, isUploading] = useActionState(async (previous: FormState, formData: FormData) => {
    const error = await uploadIconField(formData, startUpload);
    if (error) return { error };
    return uploadAction(previous, formData);
  }, {});
  const [removeState, removeFormAction, isRemoving] = useActionState(removeAction, {});
  const isBusy = isUploading || isRemoving;
  const isProcessing = iconStatus === "PROCESSING";
  const statusError = iconStatus === "FAILED" ? "We couldn't read the last image. Try a PNG, JPEG, WebP or GIF." : undefined;

  return (
    <form ref={formRef} action={uploadFormAction} className={styles.section}>
      {Object.entries(fields).map(([fieldName, value]) => (
        <input key={fieldName} type="hidden" name={fieldName} value={value} />
      ))}
      <RefreshWhile active={isProcessing} intervalMs={2000} />
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
        {isProcessing && !isUploading && <Message text="Processing the new icon…" />}
        <Message text={state.error ?? removeState.error ?? statusError} state="error" />
      </div>
    </form>
  );
};
