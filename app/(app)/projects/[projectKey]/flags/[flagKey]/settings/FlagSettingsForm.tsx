"use client";

import { useActionState, useState, useTransition } from "react";
import type { FormState, Variation } from "@/app/types";
import { Button } from "@/app/_components/Button";
import { Field } from "@/app/_components/Field";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { formatValue } from "@/lib/flags/values";
import { removeVariation, updateFlagSettings } from "../../actions";
import styles from "./FlagSettingsForm.module.css";

type Props = {
  flagId: string;
  flagKey: string;
  typeLabel: string;
  isBoolean: boolean;
  name: string;
  description: string;
  variations: Variation[];
  canEdit: boolean;
};

export const FlagSettingsForm = ({ flagId, flagKey, typeLabel, isBoolean, name, description, variations, canEdit }: Props) => {
  const [added, setAdded] = useState<string[]>([]);
  const [state, formAction, isPending] = useActionState(async (previous: FormState, formData: FormData) => {
    const result = await updateFlagSettings(previous, formData);
    if (!result.error) setAdded([]);
    return result;
  }, {});
  const [removeError, setRemoveError] = useState<string>();
  const [isRemoving, startRemoving] = useTransition();

  const remove = (variationId: string) => {
    setRemoveError(undefined);
    startRemoving(async () => {
      const formData = new FormData();
      formData.set("flagId", flagId);
      formData.set("variationId", variationId);
      const result = await removeVariation({}, formData);
      setRemoveError(result.error);
    });
  };

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="flagId" value={flagId} />
      <fieldset className={styles.fields} disabled={!canEdit}>
        <Field label="Name">
          <Input name="name" required defaultValue={state.values?.name ?? name} />
        </Field>
        <Field label="Description">
          <Input name="description" defaultValue={state.values?.description ?? description} />
        </Field>
        <div className={styles.readonly}>
          <Field label="Key (can't change)">
            <Input value={flagKey} readOnly disabled />
          </Field>
          <Field label="Type (can't change)">
            <Input value={typeLabel} readOnly disabled />
          </Field>
        </div>
        <div className={styles.variations}>
          <span className={styles.label}>Variations</span>
          {variations.map((variation) => (
            <div key={variation.id} className={styles.variation}>
              <Input
                name={`variation-${variation.id}`}
                aria-label="Variation value"
                defaultValue={formatValue(variation.value)}
                readOnly={isBoolean}
              />
              {!isBoolean && variations.length > 2 && (
                <Button
                  variant="link"
                  onClick={() => remove(variation.id)}
                  disabled={isRemoving}
                  aria-label={`Remove ${formatValue(variation.value)}`}
                >
                  ×
                </Button>
              )}
            </div>
          ))}
          {added.map((value, index) => (
            <div key={index} className={styles.variation}>
              <Input
                name="newVariation"
                aria-label="New variation value"
                value={value}
                onChange={(event) => setAdded(added.map((item, i) => (i === index ? event.target.value : item)))}
              />
              <Button variant="link" onClick={() => setAdded(added.filter((_, i) => i !== index))} aria-label="Remove new variation">
                ×
              </Button>
            </div>
          ))}
          {!isBoolean && (
            <Button variant="link" onClick={() => setAdded([...added, ""])}>
              + add variation
            </Button>
          )}
          <Message text={removeError} state="error" />
        </div>
      </fieldset>
      <Message text={state.error} state="error" />
      <Message text={state.success} state="success" />
      {canEdit && (
        <div>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </form>
  );
};
