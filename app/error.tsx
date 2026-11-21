"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "./_components/Button";
import styles from "./error.module.css";
import { Text } from "./_components/Text";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className={styles.page}>
      <Text variant="title">Something went wrong</Text>
      <Text variant="body" color="muted">
        Please try again. If it keeps happening, contact support with this error id.
      </Text>
      {error.digest && <code className={styles.code}>Error id: {error.digest}</code>}
      <Button variant="solid" onClick={() => retry()}>
        Try again
      </Button>
    </main>
  );
}
