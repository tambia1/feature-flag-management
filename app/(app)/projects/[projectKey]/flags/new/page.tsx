import type { Metadata } from "next";
import { getProjectContext, searchString } from "@/lib/flags/context";
import { requireUser } from "@/lib/session";
import { NoAccess } from "../../../../_components/NoAccess";
import { Page } from "../../../../_components/Page";
import { NewFlagForm } from "./NewFlagForm";

export const metadata: Metadata = { title: "New flag" };

export default async function NewFlagPage({ params, searchParams }: PageProps<"/projects/[projectKey]/flags/new">) {
  const { projectKey } = await params;
  const user = await requireUser();
  const context = await getProjectContext(user, projectKey, searchString((await searchParams).env));

  if (!context) {
    return (
      <Page title="New flag">
        <NoAccess />
      </Page>
    );
  }

  return (
    <Page title="New flag" subtitle={context.project.name}>
      {context.canEditFlags ? (
        <NewFlagForm projectId={context.project.id} cancelHref={`/projects/${projectKey}/flags?env=${context.environment.key}`} />
      ) : (
        <p>Only users who are editor in the project can create flags.</p>
      )}
    </Page>
  );
}
