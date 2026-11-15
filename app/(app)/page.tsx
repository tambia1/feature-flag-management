import { redirect } from "next/navigation";
import { EmptyState } from "@/app/_components/EmptyState";
import { LinkButton } from "@/app/_components/LinkButton";
import { getAccessibleProjects } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { NoAccess } from "./_components/NoAccess";
import { Page } from "./_components/Page";

export default async function HomePage() {
  const user = await requireUser();
  const [first] = await getAccessibleProjects(user);

  if (first) {
    redirect(`/projects/${first.key}/flags`);
  }

  const projectCount = await prisma.project.count({ where: { companyId: user.companyId } });

  if (projectCount > 0) {
    return (
      <Page title="Flags">
        <NoAccess />
      </Page>
    );
  }

  return (
    <Page title="Flags">
      <EmptyState
        icon="▢"
        title="No projects yet"
        text={
          user.role === "ADMIN"
            ? "Projects are your apps, e.g. Google Docs.\nCreate one to start adding flags."
            : "Ask your company admin to create a project."
        }
      >
        {user.role === "ADMIN" && (
          <LinkButton href="/settings/projects" variant="primary">
            Go to Projects
          </LinkButton>
        )}
      </EmptyState>
    </Page>
  );
}
