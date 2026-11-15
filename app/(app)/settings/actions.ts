"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/types";
import { runAction, text, UserError } from "@/lib/actions";
import { track } from "@/lib/analytics";
import { writeLog } from "@/lib/audit";
import { generateSdkKey } from "@/lib/sdk-key";
import { KEY_PATTERN } from "@/lib/flags/values";
import { prisma, type Tx } from "@/lib/prisma";
import { publishFlagChange } from "@/lib/pubsub";
import { assertCompanyAdmin, AuthError } from "@/lib/session";
import { createUserWithPassword, setUserPassword } from "@/lib/users";

const name = (label: string) => z.string().trim().min(1, `Enter a ${label}`).max(100);
const key = z.string().regex(KEY_PATTERN, "Key: lowercase letters, numbers and dashes, e.g. web-app").max(64);
const password = z.string().min(4, "Password: at least 4 characters").max(128);
const role = z.enum(["ADMIN", "MEMBER"]);

// Every lookup below is scoped to the admin's company: the company always comes from the session, never the form.

async function findUser(companyId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, companyId }, select: { id: true, name: true, email: true, role: true } });
  if (!user) throw new AuthError(403);
  return user;
}

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

/** A company must always have at least one admin. */
async function assertNotLastAdmin(tx: Tx, companyId: string, userId: string) {
  const otherAdmins = await tx.user.count({ where: { companyId, role: "ADMIN", id: { not: userId } } });

  if (otherAdmins === 0) {
    throw new UserError("The last admin can't be removed or demoted.");
  }
}

// ---------- Company ----------

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

// ---------- Users ----------

const userSchema = z.object({ name: name("name"), email: z.email("Enter a valid email").max(200), role });

export async function createUser(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const input = userSchema.parse({ name: text(formData, "name"), email: text(formData, "email"), role: text(formData, "role") });
    const newPassword = password.parse(formData.get("password"));

    if (await prisma.user.findUnique({ where: { email: input.email.toLowerCase() }, select: { id: true } })) {
      throw new UserError("A user with this email already exists.");
    }

    const created = await prisma.$transaction(async (tx) => {
      const user = await createUserWithPassword(tx, { companyId: admin.companyId, ...input, password: newPassword });
      await writeLog(tx, admin, { action: "added user", targetType: "User", target: user.email, change: input.role.toLowerCase() });
      return user;
    });

    track(admin.id, "user invited");
    refresh();
    return { success: `Added ${created.name}` };
  });
}

export async function updateUser(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const user = await findUser(admin.companyId, text(formData, "userId"));
    const input = userSchema.parse({ name: text(formData, "name"), email: text(formData, "email"), role: text(formData, "role") });
    const rawPassword = String(formData.get("password") ?? "");
    const newPassword = rawPassword ? password.parse(rawPassword) : null;

    const changes: string[] = [];
    if (input.name !== user.name) changes.push(`name: ${user.name} → ${input.name}`);
    if (input.email.toLowerCase() !== user.email) changes.push(`email: ${user.email} → ${input.email.toLowerCase()}`);
    if (input.role !== user.role) changes.push(`${user.role.toLowerCase()} → ${input.role.toLowerCase()}`);
    if (newPassword) changes.push("new password");

    if (changes.length === 0) {
      return { success: "No changes" };
    }

    await prisma.$transaction(async (tx) => {
      if (user.role === "ADMIN" && input.role !== "ADMIN") {
        await assertNotLastAdmin(tx, admin.companyId, user.id);
      }

      await tx.user.update({ where: { id: user.id }, data: { name: input.name, email: input.email.toLowerCase(), role: input.role } });

      if (newPassword) {
        await setUserPassword(tx, user.id, newPassword);
      }

      await writeLog(tx, admin, {
        action: input.role !== user.role ? "changed role" : "edited user",
        targetType: "User",
        target: input.email.toLowerCase(),
        change: changes.join(" · "),
      });
    });

    refresh();
    return { success: "Saved" };
  });
}

export async function deleteUser(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const user = await findUser(admin.companyId, text(formData, "userId"));

    if (user.id === admin.id) {
      throw new UserError("You can't delete yourself. Ask another admin.");
    }

    await prisma.$transaction(async (tx) => {
      if (user.role === "ADMIN") {
        await assertNotLastAdmin(tx, admin.companyId, user.id);
      }

      // Sessions are deleted with the user (CASCADE), so they are logged out right away.
      await tx.user.delete({ where: { id: user.id } });
      await writeLog(tx, admin, { action: "removed user", targetType: "User", target: user.email });
    });

    refresh();
  });
}

// ---------- Teams ----------

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

/** Saves the whole permissions grid of one team: a role (none / viewer / editor) per environment. */
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

// ---------- Projects & environments ----------

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
      // FlagEnvironment first: its off value points to a variation (RESTRICT).
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

      // Every existing flag gets this environment too: OFF, with the starting values of another environment.
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
            targets: [],
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

/** Creates a new SDK key; the old one stops working right away. */
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

    // Clears the cached old key on every server.
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
