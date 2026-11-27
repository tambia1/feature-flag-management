"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import type { FormState, IconStatus } from "@/app/types";
import { Button } from "@/app/_components/Button";
import { ConfirmAction } from "@/app/_components/ConfirmAction";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { CompanyIcon } from "../../_components/CompanyIcon";
import { uploadIconField } from "../../_components/uploadIcon";
import { deleteCompany, startCompanyIconUpload, updateCompany } from "../actions";
import styles from "./CompanyRow.module.css";
import { Text } from "@/app/_components/Text";

type Props = {
  company: { id: string; name: string; isPlatform: boolean; iconThumbUrl: string | null; iconStatus: IconStatus | null };
  admins: string;
  users: number;
  projects: number;
  flags: number;
  created: string;
};

export const CompanyRow = ({ company, admins, users, projects, flags, created }: Props) => {
  const [editing, setEditing] = useState(false);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const resetIcon = () => {
    if (iconPreview) URL.revokeObjectURL(iconPreview);
    setIconPreview(null);
    setRemoveIcon(false);
    if (iconInputRef.current) iconInputRef.current.value = "";
  };

  const stopEditing = () => {
    resetIcon();
    setEditing(false);
  };

  const [state, formAction, isPending] = useActionState(async (previous: FormState, formData: FormData) => {
    const error = await uploadIconField(formData, startCompanyIconUpload);
    if (error) return { error, values: { name: String(formData.get("name") ?? "") } };
    const result = await updateCompany(previous, formData);
    if (!result.error) stopEditing();
    return result;
  }, {});
  const formId = `company-${company.id}`;
  const shownIcon = removeIcon ? null : (iconPreview ?? company.iconThumbUrl);

  return (
    <tr>
      <td>
        {editing ? (
          <>
            <form id={formId} action={formAction}>
              <input type="hidden" name="companyId" value={company.id} />
              {removeIcon && <input type="hidden" name="removeIcon" value="1" />}
            </form>
            <div className={styles.company}>
              <CompanyIcon name={company.name} url={shownIcon} size="small" />
              <Input
                form={formId}
                name="name"
                compact
                aria-label="Company name"
                required
                defaultValue={state.values?.name ?? company.name}
              />
              <Input
                ref={iconInputRef}
                form={formId}
                type="file"
                name="icon"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (iconPreview) URL.revokeObjectURL(iconPreview);
                  setIconPreview(URL.createObjectURL(file));
                  setRemoveIcon(false);
                }}
              />
              <div className={styles.iconActions}>
                <Button variant="link" onClick={() => iconInputRef.current?.click()}>
                  {shownIcon ? "Change icon" : "Add icon"}
                </Button>
                {shownIcon && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <Button
                      variant="link"
                      onClick={() => {
                        resetIcon();
                        setRemoveIcon(Boolean(company.iconThumbUrl));
                      }}
                    >
                      Remove icon
                    </Button>
                  </>
                )}
              </div>
            </div>
            <Message text={state.error} state="error" />
          </>
        ) : (
          <span className={styles.company}>
            <CompanyIcon name={company.name} url={company.iconThumbUrl} size="small" />
            <Link href={`/platform/companies/${company.id}`} className={styles.name}>
              {company.name}
            </Link>
            {company.isPlatform && (
              <Text variant="plain" color="muted">
                (platform)
              </Text>
            )}
            {company.iconStatus === "PROCESSING" && (
              <Text variant="plain" color="muted">
                (icon processing…)
              </Text>
            )}
            {company.iconStatus === "FAILED" && (
              <Text variant="plain" color="danger">
                (icon failed)
              </Text>
            )}
          </span>
        )}
      </td>
      <td>{admins}</td>
      <td>{users}</td>
      <td>{projects}</td>
      <td>{flags}</td>
      <td>{created}</td>
      <td className={styles.actions}>
        {editing ? (
          <>
            <Button key="save" type="submit" form={formId} variant="link" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
            <span aria-hidden="true"> · </span>
            <Button variant="link" onClick={stopEditing} disabled={isPending}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button key="edit" variant="link" onClick={() => setEditing(true)}>
              Edit
            </Button>
            {!company.isPlatform && (
              <>
                <span aria-hidden="true"> · </span>
                <ConfirmAction
                  action={deleteCompany}
                  fields={{ companyId: company.id }}
                  triggerLabel="Delete"
                  triggerColor="danger"
                  title="Delete company"
                  text={`This deletes "${company.name}" with its ${users} users and ${projects} projects, and all their flags.\nThis can't be undone.`}
                  confirmLabel="Delete"
                />
              </>
            )}
          </>
        )}
      </td>
    </tr>
  );
};
