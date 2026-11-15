import { requireCompanyAdmin } from "@/lib/session";

/** SETTINGS is for company admins only. */
export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  await requireCompanyAdmin();
  return children;
}
