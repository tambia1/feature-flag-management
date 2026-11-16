import { FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/app/_components/EmptyState";
import { Page } from "../../_components/Page";

export const metadata: Metadata = { title: "Test" };

export default function TestPage() {
  return (
    <Page title="Test">
      <EmptyState icon={FlaskConical} title="Test page" text="This menu item shows while the test flag is on." />
    </Page>
  );
}
