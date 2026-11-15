"use client";

import { useState } from "react";
import { Button } from "@/app/_components/Button";
import { Input } from "@/app/_components/Input";
import styles from "./PasswordField.module.css";

type Props = {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  compact?: boolean;
  form?: string;
};

const CHARACTERS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789#%&*?";

function generatePassword(length = 12): string {
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (value) => CHARACTERS[value % CHARACTERS.length]).join("");
}

export const PasswordField = ({ name, label, placeholder, required = false, compact = false, form }: Props) => {
  const [value, setValue] = useState("");

  return (
    <span className={styles.field}>
      <Input
        name={name}
        form={form}
        aria-label={label}
        value={value}
        placeholder={placeholder}
        required={required}
        compact={compact}
        minLength={4}
        autoComplete="new-password"
        spellCheck={false}
        onChange={(event) => setValue(event.target.value)}
      />
      <Button
        variant="secondary"
        icon
        onClick={() => setValue(generatePassword())}
        aria-label="Generate a password"
        title="Generate a password"
      >
        ↻
      </Button>
    </span>
  );
};
