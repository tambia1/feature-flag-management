import "server-only";
import { z } from "zod";
import type { SessionUser } from "@/app/types";
import { keyField, nameField } from "./fields";
import { writeLog } from "./logs";
import { prisma } from "./prisma";
import { publishFlagChange } from "./pubsub";
import { generateSdkKey } from "./sdk-key";
import { AuthError } from "./session";

type Project = Awaited<ReturnType<typeof findProject>>;
type Environment = Awaited<ReturnType<typeof findEnvironment>>;
type NameAndKey = { name: string; key: string };

const projectName = nameField("a project name");
const environmentName = nameField("an environment name");
const key = keyField("web-app");

export async function findProject(companyId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId },
    select: { id: true, name: true, key: true, environments: { select: { id: true } } },
  });
  if (!project) throw new AuthError(403);
  return project;
}

export async function findEnvironment(companyId: string, environmentId: string) {
  const environment = await prisma.environment.findFirst({
    where: { id: environmentId, project: { companyId } },
    select: { id: true, name: true, key: true, projectId: true, project: { select: { name: true } } },
  });
  if (!environment) throw new AuthError(403);
  return environment;
}

export async function createProject(actor: SessionUser, project: NameAndKey): Promise<string> {
  const input = z.object({ name: projectName, key }).parse(project);

  await prisma.$transaction(async (tx) => {
    await tx.project.create({ data: { companyId: actor.companyId, ...input } });
    await writeLog(tx, actor, { action: "added project", targetType: "Project", target: input.name, change: `key ${input.key}` });
  });

  return input.name;
}

export async function renameProject(actor: SessionUser, project: Project, name: string): Promise<boolean> {
  const newName = projectName.parse(name);

  if (newName === project.name) return false;

  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id: project.id }, data: { name: newName } });
    await writeLog(tx, actor, {
      action: "renamed project",
      targetType: "Project",
      target: newName,
      change: `${project.name} → ${newName}`,
    });
  });

  return true;
}

export async function deleteProject(actor: SessionUser, project: Project): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.flagEnvironment.deleteMany({ where: { flag: { projectId: project.id } } });
    await tx.project.delete({ where: { id: project.id } });
    await writeLog(tx, actor, { action: "removed project", targetType: "Project", target: project.name });
  });

  await publishFlagChange(project.environments.map((environment) => environment.id));
}

export async function addEnvironment(actor: SessionUser, project: Project, environment: NameAndKey): Promise<string> {
  const input = z.object({ name: environmentName, key }).parse(environment);

  await prisma.$transaction(async (tx) => {
    const created = await tx.environment.create({ data: { projectId: project.id, ...input, sdkKey: generateSdkKey() } });

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
          environmentId: created.id,
          isOn: false,
          offVariationId: template?.offVariationId ?? off.id,
          rules: [{ id: "default", clauses: [], serve: defaultRule as object }],
        },
      });
    }

    await writeLog(tx, actor, { action: "added environment", targetType: "Environment", target: `${project.name} · ${input.name}` });
  });

  return input.name;
}

export async function renameEnvironment(actor: SessionUser, environment: Environment, name: string): Promise<boolean> {
  const newName = environmentName.parse(name);

  if (newName === environment.name) return false;

  await prisma.$transaction(async (tx) => {
    await tx.environment.update({ where: { id: environment.id }, data: { name: newName } });
    await writeLog(tx, actor, {
      action: "renamed environment",
      targetType: "Environment",
      target: `${environment.project.name} · ${newName}`,
      change: `${environment.name} → ${newName}`,
    });
  });

  return true;
}

export async function rotateSdkKey(actor: SessionUser, environment: Environment): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.environment.update({ where: { id: environment.id }, data: { sdkKey: generateSdkKey() } });
    await writeLog(tx, actor, {
      action: "rotated SDK key",
      targetType: "Environment",
      target: `${environment.project.name} · ${environment.name}`,
    });
  });

  await publishFlagChange([environment.id]);
}

export async function deleteEnvironment(actor: SessionUser, environment: Environment): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.environment.delete({ where: { id: environment.id } });
    await writeLog(tx, actor, {
      action: "removed environment",
      targetType: "Environment",
      target: `${environment.project.name} · ${environment.name}`,
    });
  });

  await publishFlagChange([environment.id]);
}
