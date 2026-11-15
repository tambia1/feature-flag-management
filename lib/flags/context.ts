import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { EnvironmentRole, SessionUser } from "@/app/types";
import { getAccessibleProjects, type AccessibleProject } from "../permissions";
import { prisma } from "../prisma";

export type ProjectContext = {
  project: AccessibleProject;
  environment: AccessibleProject["environments"][number];
  role: EnvironmentRole;
  canEditFlags: boolean;
};

export const getProjectContext = cache(
  async (user: SessionUser, projectKey: string, environmentKey?: string | null): Promise<ProjectContext | null> => {
    const exists = await prisma.project.findUnique({
      where: { companyId_key: { companyId: user.companyId, key: projectKey } },
      select: { id: true },
    });

    if (!exists) {
      notFound();
    }

    const project = (await getAccessibleProjects(user)).find((item) => item.key === projectKey);

    if (!project) {
      return null;
    }

    const environment = project.environments.find((item) => item.key === environmentKey) ?? project.environments[0];

    return {
      project,
      environment,
      role: environment.role,
      canEditFlags: project.environments.some((item) => item.role === "EDITOR"),
    };
  },
);

export async function getFlagByKey(projectId: string, flagKey: string) {
  const flag = await prisma.flag.findUnique({
    where: { projectId_key: { projectId, key: flagKey } },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      type: true,
      archivedAt: true,
      createdAt: true,
      variations: { orderBy: { order: "asc" }, select: { id: true, value: true, order: true } },
    },
  });

  if (!flag) {
    notFound();
  }

  return flag;
}

export function searchString(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}
