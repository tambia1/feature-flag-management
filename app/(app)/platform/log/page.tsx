import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/session";
import { LogView } from "../../_components/LogView";
import { Page } from "../../_components/Page";

export const metadata: Metadata = { title: "Platform log" };

export default async function PlatformLogPage({ searchParams }: PageProps<"/platform/log">) {
  await requirePlatformAdmin();
  const platform = await prisma.company.findFirstOrThrow({ where: { isPlatform: true }, select: { id: true } });

  return (
    <Page title="Platform log" subtitle="Read-only. Companies and platform admins added, changed or removed.">
      <LogView companyId={platform.id} query={await searchParams} defaultDays={30} />
    </Page>
  );
}
