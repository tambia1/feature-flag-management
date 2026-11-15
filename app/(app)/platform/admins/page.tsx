import type { Metadata } from "next";
import { Table } from "@/app/_components/Table";
import { formatMonth } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/session";
import { Card } from "../../_components/Card";
import { Page } from "../../_components/Page";
import { AddAdminForm } from "./AddAdminForm";
import { AdminRow } from "./AdminRow";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Platform admins" };

export default async function PlatformAdminsPage() {
  const me = await requirePlatformAdmin();

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", company: { isPlatform: true } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return (
    <Page title="Platform admins">
      <Card title="Add platform admin">
        <AddAdminForm />
      </Card>
      <Table headers={["Name", "Email", "Password", "Added", ""]}>
        {admins.map((admin) => (
          <AdminRow
            key={admin.id}
            admin={{ id: admin.id, name: admin.name, email: admin.email }}
            added={formatMonth(admin.createdAt)}
            isSelf={admin.id === me.id}
          />
        ))}
      </Table>
      <p className={styles.hint}>
        Platform admins = admin users of our own (platform) company. The last platform admin can&apos;t be removed.
        <br />
        Every change goes to the platform log.
      </p>
    </Page>
  );
}
