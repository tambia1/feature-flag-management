import { Flag } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";
import styles from "./page.module.css";
import { Text } from "@/app/_components/Text";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await getCurrentUser()) {
    redirect("/");
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.logo}>
          <Flag size={14} /> Feature Flag Management
        </p>
        <Text variant="title">Log in</Text>
        <LoginForm />
      </div>
    </main>
  );
}
