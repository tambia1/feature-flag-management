import { requireCompanyAdmin } from "@/lib/session";

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  await requireCompanyAdmin();
  return children;
}
