import "server-only";
import { cache } from "react";
import type { Environment, EnvironmentRole, Project, SessionUser } from "@/app/types";
import { prisma } from "./prisma";
import { highestRole, roleAllows } from "./roles";
import { AuthError } from "./session";

export const getEnvironmentRoles = cache(async (userId: string): Promise<Map<string, EnvironmentRole>> => {
  const rows = await prisma.teamEnvironmentRole.findMany({
    where: { team: { members: { some: { userId } } } },
    select: { environmentId: true, role: true },
  });

  const roles = new Map<string, EnvironmentRole>();

  for (const row of rows) {
    const current = roles.get(row.environmentId) ?? "NONE";
    roles.set(row.environmentId, highestRole([current, row.role]) as EnvironmentRole);
  }

  return roles;
});

export type AccessibleProject = Project & {
  environments: (Environment & { role: EnvironmentRole })[];
};

export const getAccessibleProjects = cache(async (user: SessionUser): Promise<AccessibleProject[]> => {
  const roles = await getEnvironmentRoles(user.id);

  const projects = await prisma.project.findMany({
    where: { companyId: user.companyId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      key: true,
      environments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, projectId: true, name: true, key: true },
      },
    },
  });

  return projects
    .map((project) => ({
      ...project,
      environments: project.environments.flatMap((environment) => {
        const role = roles.get(environment.id);
        return role ? [{ ...environment, role }] : [];
      }),
    }))
    .filter((project) => project.environments.length > 0);
});

export async function assertEnvironmentRole(user: SessionUser, environmentId: string, needed: EnvironmentRole): Promise<void> {
  const environment = await prisma.environment.findFirst({
    where: { id: environmentId, project: { companyId: user.companyId } },
    select: { id: true },
  });

  if (!environment) {
    throw new AuthError(403);
  }

  const roles = await getEnvironmentRoles(user.id);

  if (!roleAllows(roles.get(environmentId) ?? "NONE", needed)) {
    throw new AuthError(403);
  }
}

export async function assertProjectEditor(user: SessionUser, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
    select: { environments: { select: { id: true } } },
  });

  if (!project) {
    throw new AuthError(403);
  }

  const roles = await getEnvironmentRoles(user.id);

  if (!project.environments.some((environment) => roles.get(environment.id) === "EDITOR")) {
    throw new AuthError(403);
  }
}
