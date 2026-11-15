"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "./_components/Button";
import styles from "./error.module.css";

/** Unexpected errors: a friendly message and an error id that matches the server logs. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Something went wrong</h1>
      <p className={styles.text}>Please try again. If it keeps happening, contact support with this error id.</p>
      {error.digest && <code className={styles.code}>Error id: {error.digest}</code>}
      <Button variant="primary" onClick={() => retry()}>
        Try again
      </Button>
    </main>
  );
}
