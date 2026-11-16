"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/app/_components/Button";
import styles from "./CodeBlock.module.css";

type Props = {
  code: string;
  label: string;
};

export const CodeBlock = ({ code, label }: Props) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <figure className={styles.block}>
      <figcaption className={styles.header}>
        <span className={styles.label}>{label}</span>
        <Button variant="link" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
        </Button>
      </figcaption>
      <pre className={styles.code}>
        <code>{code}</code>
      </pre>
    </figure>
  );
};
