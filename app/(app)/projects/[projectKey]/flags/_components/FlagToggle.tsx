"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Button } from "@/app/_components/Button";
import { Dialog } from "@/app/_components/Dialog";
import { Field } from "@/app/_components/Field";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { Toggle } from "@/app/_components/Toggle";
import { setFlagOn } from "../actions";
import styles from "./FlagToggle.module.css";

type Props = {
  flagId: string;
  flagKey: string;
  environmentId: string;
  environmentName: string;
  isOn: boolean;
  isProduction: boolean;
  disabled: boolean;
  showLabel?: boolean;
};

export const FlagToggle = ({ flagId, flagKey, environmentId, environmentName, isOn, isProduction, disabled, showLabel = false }: Props) => {
  const [optimisticOn, setOptimisticOn] = useOptimistic(isOn);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [comment, setComment] = useState("");

  const save = (next: boolean, withComment = "") => {
    setError(undefined);
    startTransition(async () => {
      setOptimisticOn(next);
      const formData = new FormData();
      formData.set("flagId", flagId);
      formData.set("environmentId", environmentId);
      formData.set("isOn", String(next));
      formData.set("comment", withComment);
      const result = await setFlagOn({}, formData);

      if (result.error) {
        setError(result.error);
      }
    });
  };

  const onClick = () => {
    if (isProduction) {
      setComment("");
      setConfirming(true);
    } else {
      save(!optimisticOn);
    }
  };

  const next = !optimisticOn;

  return (
    <span className={styles.toggle}>
      <Toggle
        checked={optimisticOn}
        danger={isProduction}
        label={`${flagKey} in ${environmentName}`}
        disabled={disabled || isPending}
        onClick={onClick}
      />
      {showLabel && <span className={styles.label}>{optimisticOn ? "On — serving the rules below" : "Off — serving the off value"}</span>}
      <Message text={error} state="error" />
      <Dialog open={confirming} title={`Turn ${next ? "on" : "off"} in ${environmentName}?`} onClose={() => setConfirming(false)}>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            setConfirming(false);
            save(next, comment);
          }}
        >
          <p className={styles.text}>
            {flagKey} · {environmentName}
            <br />
            {next ? "Users will start getting the on value / rules right away." : "Users will get the off value right away."}
          </p>
          <Field label="Comment (saved to the log)">
            <Input value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} />
          </Field>
          <div className={styles.actions}>
            <Button variant="outline" color="neutral" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="solid" color="danger">
              Turn {next ? "on" : "off"}
            </Button>
          </div>
        </form>
      </Dialog>
    </span>
  );
};
