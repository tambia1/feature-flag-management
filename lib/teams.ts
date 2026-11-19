import "server-only";
import { z } from "zod";
import type { SessionUser } from "@/app/types";
import { nameField } from "./fields";
import { writeLog } from "./logs";
import { prisma } from "./prisma";
import { AuthError } from "./session";

type Team = Awaited<ReturnType<typeof findTeam>>;
type Member = { id: string; name: string };

const teamName = nameField("a team name");
const ROLE_LABEL = { NONE: "none", VIEWER: "viewer", EDITOR: "editor" } as const;
const role = z.enum(["NONE", "VIEWER", "EDITOR"]).catch("NONE");

export async function findTeam(companyId: string, teamId: string) {
  const team = await prisma.team.findFirst({ where: { id: teamId, companyId }, select: { id: true, name: true } });
  if (!team) throw new AuthError(403);
  return team;
}

export async function createTeam(actor: SessionUser, name: string): Promise<string> {
  const newName = teamName.parse(name);

  await prisma.$transaction(async (tx) => {
    await tx.team.create({ data: { companyId: actor.companyId, name: newName } });
    await writeLog(tx, actor, { action: "added team", targetType: "Team", target: newName });
  });

  return newName;
}

export async function renameTeam(actor: SessionUser, team: Team, name: string): Promise<boolean> {
  const newName = teamName.parse(name);

  if (newName === team.name) return false;

  await prisma.$transaction(async (tx) => {
    await tx.team.update({ where: { id: team.id }, data: { name: newName } });
    await writeLog(tx, actor, { action: "renamed team", targetType: "Team", target: newName, change: `${team.name} → ${newName}` });
  });

  return true;
}

export async function deleteTeam(actor: SessionUser, team: Team): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.team.delete({ where: { id: team.id } });
    await writeLog(tx, actor, { action: "removed team", targetType: "Team", target: team.name });
  });
}

export async function addTeamMember(actor: SessionUser, team: Team, member: Member): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.teamMember.create({ data: { teamId: team.id, userId: member.id } });
    await writeLog(tx, actor, { action: "added member", targetType: "Team", target: team.name, change: `+ ${member.name}` });
  });
}

export async function removeTeamMember(actor: SessionUser, team: Team, member: Member): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.teamMember.delete({ where: { teamId_userId: { teamId: team.id, userId: member.id } } });
    await writeLog(tx, actor, { action: "removed member", targetType: "Team", target: team.name, change: `− ${member.name}` });
  });
}

export async function saveTeamRoles(actor: SessionUser, team: Team, roles: Record<string, string>): Promise<number> {
  const environments = await prisma.environment.findMany({
    where: { project: { companyId: actor.companyId } },
    select: { id: true, name: true, project: { select: { name: true } }, roles: { where: { teamId: team.id }, select: { role: true } } },
  });

  let changed = 0;

  await prisma.$transaction(async (tx) => {
    for (const environment of environments) {
      const next = role.parse(roles[environment.id]);
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

      changed += 1;
      await writeLog(tx, actor, {
        action: "changed role",
        targetType: "Team",
        target: `${team.name} · ${environment.project.name} · ${environment.name}`,
        change: `${ROLE_LABEL[current]} → ${ROLE_LABEL[next]}`,
      });
    }
  });

  return changed;
}
