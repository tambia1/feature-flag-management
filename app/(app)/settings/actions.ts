"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/types";
import { runAction, text } from "@/lib/actions";
import { track } from "@/lib/analytics";
import { writeLog } from "@/lib/logs";
import { generateSdkKey } from "@/lib/sdk-key";
import { KEY_PATTERN } from "@/lib/flags/values";
import { prisma } from "@/lib/prisma";
import { publishFlagChange } from "@/lib/pubsub";
import { iconFile, removeCompanyIcon, setCompanyIcon } from "@/lib/company-icon";
import { addCompanyUser, editCompanyUser, findUser, removeCompanyUser } from "@/lib/company-users";
import { assertCompanyAdmin, AuthError } from "@/lib/session";

const name = (label: string) => z.string().trim().min(1, `Enter a ${label}`).max(100);
const key = z.string().regex(KEY_PATTERN, "Key: lowercase letters, numbers and dashes, e.g. web-app").max(64);

async function findTeam(companyId: string, teamId: string) {
  const team = await prisma.team.findFirst({ where: { id: teamId, companyId }, select: { id: true, name: true } });
  if (!team) throw new AuthError(403);
  return team;
}

async function findProject(companyId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true, name: true, key: true, environments: { select: { id: true } } },
  });
  if (!project) throw new AuthError(403);
  return project;
}

async function findEnvironment(companyId: string, environmentId: string) {
  const environment = await prisma.environment.findFirst({
    where: { id: environmentId, project: { companyId } },
    select: { id: true, name: true, key: true, projectId: true, project: { select: { name: true } } },
  });
  if (!environment) throw new AuthError(403);
  return environment;
}

export async function updateCompany(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const newName = name("company name").parse(text(formData, "name"));

    if (newName === admin.companyName) {
      return { success: "No changes" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.company.update({ where: { id: admin.companyId }, data: { name: newName } });
      await writeLog(tx, admin, {
        action: "renamed company",
        targetType: "Company",
        target: newName,
        change: `${admin.companyName} → ${newName}`,
      });
    });

    refresh();
    return { success: "Saved" };
  });
}

export async function updateCompanyIcon(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    await setCompanyIcon(admin.companyId, iconFile(formData), (tx) =>
      writeLog(tx, admin, { action: "changed company icon", targetType: "Company", target: admin.companyName }),
    );
    refresh();
    return { success: "Icon updated" };
  });
}

export async function deleteCompanyIcon(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    await removeCompanyIcon(admin.companyId, (tx) =>
      writeLog(tx, admin, { action: "removed company icon", targetType: "Company", target: admin.companyName }),
    );
    refresh();
    return { success: "Icon removed" };
  });
}

export async function createUser(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const result = await addCompanyUser(admin, { id: admin.companyId, name: admin.companyName }, formData);
    track(admin.id, "user invited");
    refresh();
    return result;
  });
}

export async function updateUser(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const result = await editCompanyUser(admin, { id: admin.companyId, name: admin.companyName }, formData);
    refresh();
    return result;
  });
}

export async function deleteUser(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    await removeCompanyUser(admin, { id: admin.companyId, name: admin.companyName }, formData);
    refresh();
  });
}

export async function createTeam(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const teamName = name("team name").parse(text(formData, "name"));

    await prisma.$transaction(async (tx) => {
      await tx.team.create({ data: { companyId: admin.companyId, name: teamName } });
      await writeLog(tx, admin, { action: "added team", targetType: "Team", target: teamName });
    });

    refresh();
    return { success: `Added ${teamName}` };
  });
}

export async function renameTeam(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const team = await findTeam(admin.companyId, text(formData, "teamId"));
    const teamName = name("team name").parse(text(formData, "name"));

    if (teamName === team.name) return { success: "No changes" };

    await prisma.$transaction(async (tx) => {
      await tx.team.update({ where: { id: team.id }, data: { name: teamName } });
      await writeLog(tx, admin, { action: "renamed team", targetType: "Team", target: teamName, change: `${team.name} → ${teamName}` });
    });

    refresh();
    return { success: "Saved" };
  });
}

export async function deleteTeam(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const team = await findTeam(admin.companyId, text(formData, "teamId"));

    await prisma.$transaction(async (tx) => {
      await tx.team.delete({ where: { id: team.id } });
      await writeLog(tx, admin, { action: "removed team", targetType: "Team", target: team.name });
    });

    refresh();
  });
}

export async function addTeamMember(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const team = await findTeam(admin.companyId, text(formData, "teamId"));
    const user = await findUser(admin.companyId, text(formData, "userId"));

    await prisma.$transaction(async (tx) => {
      await tx.teamMember.create({ data: { teamId: team.id, userId: user.id } });
      await writeLog(tx, admin, { action: "added member", targetType: "Team", target: team.name, change: `+ ${user.name}` });
    });

    refresh();
  });
}

export async function removeTeamMember(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const team = await findTeam(admin.companyId, text(formData, "teamId"));
    const user = await findUser(admin.companyId, text(formData, "userId"));

    await prisma.$transaction(async (tx) => {
      await tx.teamMember.delete({ where: { teamId_userId: { teamId: team.id, userId: user.id } } });
      await writeLog(tx, admin, { action: "removed member", targetType: "Team", target: team.name, change: `− ${user.name}` });
    });

    refresh();
  });
}

const ROLE_LABEL = { NONE: "none", VIEWER: "viewer", EDITOR: "editor" } as const;

export async function saveTeamPermissions(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const team = await findTeam(admin.companyId, text(formData, "teamId"));

    const environments = await prisma.environment.findMany({
      where: { project: { companyId: admin.companyId } },
      select: { id: true, name: true, project: { select: { name: true } }, roles: { where: { teamId: team.id }, select: { role: true } } },
    });

    const changes: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const environment of environments) {
        const next = z
          .enum(["NONE", "VIEWER", "EDITOR"])
          .catch("NONE")
          .parse(text(formData, `role-${environment.id}`));
        const current = environment.roles[0]?.role ?? "NONE";

        if (next === current) continue;

        if (next === "NONE") {
          await tx.teamEnvironmentRole.delete({ where: { teamId_environmentId: { teamId: team.id, environmentId: environment.id } } });
        } else {
          await tx.teamEnvironmentRole.upsert({
            where: { teamId_environmentId: { teamId: team.id, environmentId: environment.id } },
            create: { teamId: team.id, environmentId: environment.id, role: next },
            update: { role: next },
          });
        }

        const change = `${ROLE_LABEL[current]} → ${ROLE_LABEL[next]}`;
        changes.push(`${environment.project.name} · ${environment.name}: ${change}`);
        await writeLog(tx, admin, {
          action: "changed role",
          targetType: "Team",
          target: `${team.name} · ${environment.project.name} · ${environment.name}`,
          change,
        });
      }
    });

    refresh();
    return { success: changes.length ? "Saved" : "No changes" };
  });
}

export async function createProject(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const input = z.object({ name: name("project name"), key }).parse({ name: text(formData, "name"), key: text(formData, "key") });

    await prisma.$transaction(async (tx) => {
      await tx.project.create({ data: { companyId: admin.companyId, ...input } });
      await writeLog(tx, admin, { action: "added project", targetType: "Project", target: input.name, change: `key ${input.key}` });
    });

    track(admin.id, "project created");
    refresh();
    return { success: `Added ${input.name}` };
  });
}

export async function renameProject(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const project = await findProject(admin.companyId, text(formData, "projectId"));
    const projectName = name("project name").parse(text(formData, "name"));

    if (projectName === project.name) return { success: "No changes" };

    await prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { id: project.id }, data: { name: projectName } });
      await writeLog(tx, admin, {
        action: "renamed project",
        targetType: "Project",
        target: projectName,
        change: `${project.name} → ${projectName}`,
      });
    });

    refresh();
    return { success: "Saved" };
  });
}

export async function deleteProject(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const project = await findProject(admin.companyId, text(formData, "projectId"));

    await prisma.$transaction(async (tx) => {
      await tx.flagEnvironment.deleteMany({ where: { flag: { projectId: project.id } } });
      await tx.project.delete({ where: { id: project.id } });
      await writeLog(tx, admin, { action: "removed project", targetType: "Project", target: project.name });
    });

    await publishFlagChange(project.environments.map((environment) => environment.id));
    refresh();
  });
}

export async function addEnvironment(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const project = await findProject(admin.companyId, text(formData, "projectId"));
    const input = z.object({ name: name("environment name"), key }).parse({ name: text(formData, "name"), key: text(formData, "key") });

    await prisma.$transaction(async (tx) => {
      const environment = await tx.environment.create({ data: { projectId: project.id, ...input, sdkKey: generateSdkKey() } });

      const flags = await tx.flag.findMany({
        where: { projectId: project.id },
        select: {
          id: true,
          variations: { orderBy: { order: "asc" }, select: { id: true } },
          environments: { take: 1, orderBy: { environment: { createdAt: "asc" } }, select: { offVariationId: true, rules: true } },
        },
      });

      for (const flag of flags) {
        const template = flag.environments[0];
        const [on, off] = flag.variations;
        const defaultRule = template
          ? ((template.rules as { serve: unknown }[]).at(-1)?.serve ?? { variationId: on.id })
          : { variationId: on.id };

        await tx.flagEnvironment.create({
          data: {
            flagId: flag.id,
            environmentId: environment.id,
            isOn: false,
            offVariationId: template?.offVariationId ?? off.id,
            rules: [{ id: "default", clauses: [], serve: defaultRule as object }],
          },
        });
      }

      await writeLog(tx, admin, { action: "added environment", targetType: "Environment", target: `${project.name} · ${input.name}` });
    });

    refresh();
    return { success: `Added ${input.name}` };
  });
}

export async function renameEnvironment(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const environment = await findEnvironment(admin.companyId, text(formData, "environmentId"));
    const environmentName = name("environment name").parse(text(formData, "name"));

    if (environmentName === environment.name) return { success: "No changes" };

    await prisma.$transaction(async (tx) => {
      await tx.environment.update({ where: { id: environment.id }, data: { name: environmentName } });
      await writeLog(tx, admin, {
        action: "renamed environment",
        targetType: "Environment",
        target: `${environment.project.name} · ${environmentName}`,
        change: `${environment.name} → ${environmentName}`,
      });
    });

    refresh();
    return { success: "Saved" };
  });
}

export async function rotateSdkKey(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const environment = await findEnvironment(admin.companyId, text(formData, "environmentId"));

    await prisma.$transaction(async (tx) => {
      await tx.environment.update({ where: { id: environment.id }, data: { sdkKey: generateSdkKey() } });
      await writeLog(tx, admin, {
        action: "rotated SDK key",
        targetType: "Environment",
        target: `${environment.project.name} · ${environment.name}`,
      });
    });

    await publishFlagChange([environment.id]);
    refresh();
  });
}

export async function deleteEnvironment(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const environment = await findEnvironment(admin.companyId, text(formData, "environmentId"));

    await prisma.$transaction(async (tx) => {
      await tx.environment.delete({ where: { id: environment.id } });
      await writeLog(tx, admin, {
        action: "removed environment",
        targetType: "Environment",
        target: `${environment.project.name} · ${environment.name}`,
      });
    });

    await publishFlagChange([environment.id]);
    refresh();
  });
}
