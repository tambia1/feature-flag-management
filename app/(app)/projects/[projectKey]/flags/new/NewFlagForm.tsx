"use client";

import { useActionState, useState } from "react";
import type { FlagType } from "@/app/types";
import { Button } from "@/app/_components/Button";
import { Field } from "@/app/_components/Field";
import { Input } from "@/app/_components/Input";
import { LinkButton } from "@/app/_components/LinkButton";
import { Message } from "@/app/_components/Message";
import { Select } from "@/app/_components/Select";
import { FLAG_TYPES } from "@/lib/flags/values";
import { createFlag } from "../actions";
import styles from "./NewFlagForm.module.css";

type Props = {
  projectId: string;
  cancelHref: string;
};

const DEFAULT_VARIATIONS: Record<FlagType, string[]> = {
  BOOLEAN: ["true", "false"],
  STRING: ["", ""],
  NUMBER: ["", ""],
  JSON: ['{"enabled": true}', '{"enabled": false}'],
};

export const NewFlagForm = ({ projectId, cancelHref }: Props) => {
  const [state, formAction, isPending] = useActionState(createFlag, {});
  const [type, setType] = useState<FlagType>("BOOLEAN");
  const [variations, setVariations] = useState(DEFAULT_VARIATIONS.BOOLEAN);
  const [onIndex, setOnIndex] = useState(0);
  const [offIndex, setOffIndex] = useState(1);

  const changeType = (next: FlagType) => {
    setType(next);
    setVariations(DEFAULT_VARIATIONS[next]);
    setOnIndex(0);
    setOffIndex(1);
  };

  const removeVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index));
    setOnIndex(0);
    setOffIndex(1);
  };

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="onIndex" value={onIndex} />
      <input type="hidden" name="offIndex" value={offIndex} />
      <div className={styles.fields}>
        <Field label="Key · used in code, can't change later">
          <Input name="key" required placeholder="homepage-banner" pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={state.values?.key} />
        </Field>
        <Field label="Name">
          <Input name="name" required placeholder="Homepage banner" defaultValue={state.values?.name} />
        </Field>
        <Field label="Description">
          <Input name="description" defaultValue={state.values?.description} />
        </Field>
        <Field label="Type">
          <Select name="type" value={type} onChange={(event) => changeType(event.target.value as FlagType)} options={FLAG_TYPES} />
        </Field>
        <fieldset className={styles.variations}>
          <legend className={styles.legend}>Variations</legend>
          <div className={styles.variationHead} aria-hidden="true">
            <span>On</span>
            <span>Off</span>
            <span>Value</span>
          </div>
          {variations.map((value, index) => (
            <div key={`${type}-${index}`} className={styles.variation}>
              <input
                type="radio"
                name="on"
                aria-label={`Serve variation ${index + 1} when on`}
                checked={onIndex === index}
                onChange={() => setOnIndex(index)}
              />
              <input
                type="radio"
                name="off"
                aria-label={`Serve variation ${index + 1} when off`}
                checked={offIndex === index}
                onChange={() => setOffIndex(index)}
              />
              <Input
                name="variation"
                aria-label={`Variation ${index + 1}`}
                value={value}
                readOnly={type === "BOOLEAN"}
                required={type !== "STRING"}
                onChange={(event) => setVariations(variations.map((item, i) => (i === index ? event.target.value : item)))}
              />
              {type !== "BOOLEAN" && variations.length > 2 && (
                <Button variant="link" onClick={() => removeVariation(index)} aria-label={`Remove variation ${index + 1}`}>
                  ×
                </Button>
              )}
            </div>
          ))}
          {type !== "BOOLEAN" && (
            <Button variant="link" onClick={() => setVariations([...variations, ""])}>
              + add variation
            </Button>
          )}
        </fieldset>
        <Message text={state.error} state="error" />
        <div className={styles.actions}>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "Creating…" : "Create flag"}
          </Button>
          <LinkButton href={cancelHref} variant="secondary">
            Cancel
          </LinkButton>
        </div>
      </div>
      <aside className={styles.note}>
        <p>After create:</p>
        <ul>
          <li>exists in every environment of the project</li>
          <li>OFF everywhere (serves the off value)</li>
          <li>turn it on per environment</li>
        </ul>
        <p>
          Starting values for every environment. On = default rule when the flag is on. Off = what&apos;s served when it&apos;s off. Each
          environment can change both on its Targeting tab.
        </p>
      </aside>
    </form>
  );
};
