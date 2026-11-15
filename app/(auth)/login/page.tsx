import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await getCurrentUser()) {
    redirect("/");
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.logo}>
          <span aria-hidden="true">⚑</span> Feature Flag Management
        </p>
        <h1 className={styles.title}>Log in</h1>
        <LoginForm />
        <p className={styles.hint}>
          No sign-up. Forgot your password?
          <br />
          Ask your company admin.
        </p>
      </div>
    </main>
  );
}
