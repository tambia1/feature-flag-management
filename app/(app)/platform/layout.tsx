import { requirePlatformAdmin } from "@/lib/session";

/** PLATFORM is for platform admins only. */
export default async function PlatformLayout({ children }: LayoutProps<"/platform">) {
  await requirePlatformAdmin();
  return children;
}
