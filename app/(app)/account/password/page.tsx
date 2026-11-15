import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { Page } from "../../_components/Page";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  await requireUser();

  return (
    <Page title="Change password" subtitle="Your admin set your first password. You can keep it or change it here.">
      <PasswordForm />
    </Page>
  );
}
