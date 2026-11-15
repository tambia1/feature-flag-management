import { requirePlatformAdmin } from "@/lib/session";

export default async function PlatformLayout({ children }: LayoutProps<"/platform">) {
  await requirePlatformAdmin();
  return children;
}
