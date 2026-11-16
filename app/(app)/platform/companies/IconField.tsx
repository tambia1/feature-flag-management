"use client";

import { useRef, useState } from "react";
import { Button } from "@/app/_components/Button";
import { Field } from "@/app/_components/Field";
import { Input } from "@/app/_components/Input";
import { CompanyIcon } from "../../_components/CompanyIcon";
import styles from "./IconField.module.css";

export const IconField = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <Field label="Icon">
      <span className={styles.picker}>
        <CompanyIcon name="" url={preview} size="small" />
        <Button variant="link" onClick={() => inputRef.current?.click()}>
          Change icon
        </Button>
        <Input
          ref={inputRef}
          type="file"
          name="icon"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (preview) URL.revokeObjectURL(preview);
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
        />
      </span>
    </Field>
  );
};
