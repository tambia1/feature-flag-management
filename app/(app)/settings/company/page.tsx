import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireCompanyAdmin } from "@/lib/session";
import { CompanyIconForm } from "./CompanyIconForm";
import { Page } from "../../_components/Page";
import { deleteCompanyIcon, startCompanyIconUpload, updateCompanyIcon } from "../actions";
import { CompanyForm } from "./CompanyForm";

export const metadata: Metadata = { title: "Company" };

export default async function CompanyPage() {
  const admin = await requireCompanyAdmin();
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: admin.companyId },
    select: { name: true, iconThumbUrl: true, iconStatus: true, slackWebhookUrl: true },
  });

  return (
    <Page title="Company">
      <CompanyIconForm
        name={company.name}
        iconUrl={company.iconThumbUrl}
        iconStatus={company.iconStatus}
        startUpload={startCompanyIconUpload}
        uploadAction={updateCompanyIcon}
        removeAction={deleteCompanyIcon}
      />
      <CompanyForm name={company.name} slackWebhookUrl={company.slackWebhookUrl} />
    </Page>
  );
}
