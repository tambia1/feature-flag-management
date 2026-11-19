import "server-only";
import { z } from "zod";
import type { JsonValue, Rule, SessionUser, Variation } from "@/app/types";
import type { Prisma } from "@/app/generated/prisma/client";
import { UserError } from "../errors";
import { keyField } from "../fields";
import { writeLog } from "../logs";
import { prisma } from "../prisma";
import { publishFlagChange } from "../pubsub";
import { AuthError } from "../session";
import { describeTargetingChange, type TargetingSnapshot } from "./describe";
import { formatValue, parseVariationValue } from "./values";

export type Flag = Awaited<ReturnType<typeof findFlag>>;

export async function findFlag(companyId: string, flagId: string) {
  const flag = await prisma.flag.findFirst({
    where: { id: flagId, project: { companyId } },
    select: {
      id: true,
      key: true,
      name: true,
      type: true,
      archivedAt: true,
      projectId: true,
      project: { select: { key: true, environments: { select: { id: true } } } },
      variations: { orderBy: { order: "asc" }, select: { id: true, value: true, order: true } },
    },
  });

  if (!flag) {
    throw new AuthError(403);
  }

  return flag;
}

const environmentIdsOf = (flag: Flag) => flag.project.environments.map((item) => item.id);

const newFlagSchema = z.object({
  key: keyField("new-checkout"),
  name: z.string().min(1, "Enter a name").max(100),
  description: z.string().max(500),
  type: z.enum(["BOOLEAN", "STRING", "NUMBER", "JSON"]),
});

type NewFlag = {
  key: string;
  name: string;
  description: string;
  type: string;
  variations: string[];
  onIndex: number;
  offIndex: number;
};

export async function createFlag(
  actor: SessionUser,
  projectId: string,
  newFlag: NewFlag,
): Promise<{ projectKey: string; flagKey: string }> {
  const input = newFlagSchema.parse(newFlag);
  const values = newFlag.variations.map((raw) => parseVariationValue(input.type, raw));
  const { onIndex, offIndex } = newFlag;

  if (values.length < 2) {
    throw new UserError("Add at least two variations");
  }

  if (new Set(values.map((value) => JSON.stringify(value))).size !== values.length) {
    throw new UserError("Variations must be different from each other");
  }

  if (!Number.isInteger(onIndex) || !Number.isInteger(offIndex) || !(onIndex in values) || !(offIndex in values)) {
    throw new UserError("Pick the On and Off values");
  }

  if (onIndex === offIndex) {
    throw new UserError("On and Off must be different variations");
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { key: true, environments: { select: { id: true } } },
  });

  await prisma.$transaction(async (tx) => {
    const flag = await tx.flag.create({
      data: {
        projectId,
        key: input.key,
        name: input.name,
        description: input.description,
        type: input.type,
        variations: { create: values.map((value, order) => ({ value: value as Prisma.InputJsonValue, order })) },
      },
      select: { id: true, variations: { orderBy: { order: "asc" }, select: { id: true } } },
    });

    const on = flag.variations[onIndex];
    const off = flag.variations[offIndex];

    await tx.flagEnvironment.createMany({
      data: project.environments.map((environment) => ({
        flagId: flag.id,
        environmentId: environment.id,
        isOn: false,
        offVariationId: off.id,
        rules: [{ id: "default", clauses: [], serve: { variationId: on.id } }],
      })),
    });

    await tx.flagHistory.create({ data: { flagId: flag.id, userId: actor.id, userName: actor.name, change: "created flag" } });
    await writeLog(tx, actor, { action: "created flag", targetType: "Flag", target: input.key });
  });

  await publishFlagChange(project.environments.map((environment) => environment.id));
  return { projectKey: project.key, flagKey: input.key };
}

export async function setFlagOn(
  actor: SessionUser,
  flag: Flag,
  environmentId: string,
  isOn: boolean,
  comment: string | null,
): Promise<void> {
  if (flag.archivedAt) {
    throw new UserError("Restore the flag before turning it on");
  }

  const environment = await prisma.environment.findUniqueOrThrow({ where: { id: environmentId }, select: { name: true } });
  const change = isOn ? "turned on" : "turned off";

  await prisma.$transaction(async (tx) => {
    const current = await tx.flagEnvironment.findUniqueOrThrow({
      where: { flagId_environmentId: { flagId: flag.id, environmentId } },
      select: { isOn: true },
    });

    if (current.isOn === isOn) {
      return;
    }

    await tx.flagEnvironment.update({ where: { flagId_environmentId: { flagId: flag.id, environmentId } }, data: { isOn } });
    await tx.flagHistory.create({
      data: {
        flagId: flag.id,
        environmentId,
        userId: actor.id,
        userName: actor.name,
        change,
        before: { isOn: current.isOn },
        after: { isOn },
        comment,
      },
    });
    await writeLog(tx, actor, {
      action: change,
      targetType: "Flag",
      target: `${flag.key} · ${environment.name}`,
      change: isOn ? "off → on" : "on → off",
      comment,
    });
  });

  await publishFlagChange([environmentId]);
}

const clauseSchema = z.object({
  attribute: z.string().trim().min(1, "Every condition needs an attribute").max(64),
  operator: z.enum(["is", "isNot", "contains", "startsWith", "endsWith", "greaterThan", "lessThan"]),
  values: z.array(z.string().trim().min(1)).min(1, "Every condition needs at least one value"),
});

const serveSchema = z.union([
  z.object({ variationId: z.string().min(1) }),
  z.object({
    rollout: z
      .array(z.object({ variationId: z.string().min(1), weight: z.number().int().min(0).max(100) }))
      .min(1)
      .refine((parts) => parts.reduce((sum, part) => sum + part.weight, 0) === 100, "Rollout percentages must add up to 100"),
  }),
]);

const targetingSchema = z.object({
  offVariationId: z.string().min(1),
  rules: z
    .array(z.object({ id: z.string().min(1), clauses: z.array(clauseSchema), serve: serveSchema }))
    .min(1)
    .refine((rules) => rules.at(-1)?.clauses.length === 0, "The last rule is the default rule and has no conditions")
    .refine((rules) => rules.slice(0, -1).every((rule) => rule.clauses.length > 0), "Every rule except the default needs a condition"),
});

function usedVariationIds(snapshot: z.infer<typeof targetingSchema>): string[] {
  return [
    snapshot.offVariationId,
    ...snapshot.rules.flatMap((rule) =>
      "variationId" in rule.serve ? [rule.serve.variationId] : rule.serve.rollout.map((part) => part.variationId),
    ),
  ];
}

export async function saveTargeting(
  actor: SessionUser,
  flag: Flag,
  environmentId: string,
  targeting: unknown,
  comment: string | null,
): Promise<void> {
  const input = targetingSchema.parse(targeting);
  const variationIds = new Set(flag.variations.map((variation) => variation.id));

  if (!usedVariationIds(input).every((id) => variationIds.has(id))) {
    throw new UserError("A rule uses a variation that no longer exists. Reload the page.");
  }

  const environment = await prisma.environment.findUniqueOrThrow({ where: { id: environmentId }, select: { name: true } });

  await prisma.$transaction(async (tx) => {
    const current = await tx.flagEnvironment.findUniqueOrThrow({
      where: { flagId_environmentId: { flagId: flag.id, environmentId } },
      select: { isOn: true, offVariationId: true, rules: true },
    });

    const before: TargetingSnapshot = {
      isOn: current.isOn,
      offVariationId: current.offVariationId,
      rules: current.rules as Rule[],
    };
    const after: TargetingSnapshot = { ...input, isOn: current.isOn };
    const change = describeTargetingChange(before, after, flag.variations as Variation[]);

    if (change === "no changes") {
      throw new UserError("Nothing to save — no changes.");
    }

    await tx.flagEnvironment.update({
      where: { flagId_environmentId: { flagId: flag.id, environmentId } },
      data: { offVariationId: after.offVariationId, rules: after.rules },
    });
    await tx.flagHistory.create({
      data: {
        flagId: flag.id,
        environmentId,
        userId: actor.id,
        userName: actor.name,
        change,
        before: before as unknown as Prisma.InputJsonValue,
        after: after as unknown as Prisma.InputJsonValue,
        comment,
      },
    });
    await writeLog(tx, actor, {
      action: "edited targeting",
      targetType: "Flag",
      target: `${flag.key} · ${environment.name}`,
      change,
      comment,
    });
  });

  await publishFlagChange([environmentId]);
}

const settingsSchema = z.object({
  name: z.string().min(1, "Enter a name").max(100),
  description: z.string().max(500),
});

type FlagSettings = {
  name: string;
  description: string;
  variationValues: Record<string, string | null>;
  newVariations: string[];
};

export async function updateFlagSettings(actor: SessionUser, flag: Flag, settings: FlagSettings): Promise<void> {
  const input = settingsSchema.parse({ name: settings.name, description: settings.description });

  const existing = flag.variations.map((variation) => ({
    id: variation.id,
    value: parseVariationValue(flag.type, settings.variationValues[variation.id] ?? formatValue(variation.value as JsonValue)),
  }));
  const added = settings.newVariations.filter((raw) => raw.trim() !== "").map((raw) => parseVariationValue(flag.type, raw));

  const all = [...existing.map((item) => item.value), ...added];

  if (new Set(all.map((value) => JSON.stringify(value))).size !== all.length) {
    throw new UserError("Variations must be different from each other");
  }

  const changes: string[] = [];
  if (input.name !== flag.name) changes.push(`name: ${flag.name} → ${input.name}`);

  await prisma.$transaction(async (tx) => {
    await tx.flag.update({ where: { id: flag.id }, data: { name: input.name, description: input.description } });

    for (const item of existing) {
      const before = flag.variations.find((variation) => variation.id === item.id);

      if (before && JSON.stringify(before.value) !== JSON.stringify(item.value)) {
        await tx.variation.update({ where: { id: item.id }, data: { value: item.value as Prisma.InputJsonValue } });
        changes.push(`variation: ${formatValue(before.value as JsonValue)} → ${formatValue(item.value)}`);
      }
    }

    for (const [index, value] of added.entries()) {
      await tx.variation.create({
        data: { flagId: flag.id, value: value as Prisma.InputJsonValue, order: flag.variations.length + index },
      });
      changes.push(`added variation ${formatValue(value)}`);
    }

    const change = changes.join(" · ") || "edited description";
    await tx.flagHistory.create({ data: { flagId: flag.id, userId: actor.id, userName: actor.name, change } });
    await writeLog(tx, actor, { action: "edited flag", targetType: "Flag", target: flag.key, change });
  });

  await publishFlagChange(environmentIdsOf(flag));
}

export async function removeVariation(actor: SessionUser, flag: Flag, variationId: string): Promise<void> {
  const variation = flag.variations.find((item) => item.id === variationId);

  if (!variation) {
    throw new UserError("This variation no longer exists.");
  }

  if (flag.variations.length <= 2) {
    throw new UserError("A flag needs at least two variations.");
  }

  const environments = await prisma.flagEnvironment.findMany({
    where: { flagId: flag.id },
    select: { offVariationId: true, rules: true },
  });

  const inUse = environments.some(
    (environment) => environment.offVariationId === variation.id || JSON.stringify(environment.rules).includes(`"${variation.id}"`),
  );

  if (inUse) {
    throw new UserError("This variation is used as an off value or in a rule. Change those first.");
  }

  const change = `removed variation ${formatValue(variation.value as JsonValue)}`;

  await prisma.$transaction(async (tx) => {
    await tx.variation.delete({ where: { id: variation.id } });
    await tx.flagHistory.create({ data: { flagId: flag.id, userId: actor.id, userName: actor.name, change } });
    await writeLog(tx, actor, { action: "edited flag", targetType: "Flag", target: flag.key, change });
  });
}

export async function archiveFlag(actor: SessionUser, flag: Flag): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.flag.update({ where: { id: flag.id }, data: { archivedAt: new Date() } });
    await tx.flagHistory.create({ data: { flagId: flag.id, userId: actor.id, userName: actor.name, change: "archived" } });
    await writeLog(tx, actor, { action: "archived", targetType: "Flag", target: flag.key });
  });

  await publishFlagChange(environmentIdsOf(flag));
}

export async function restoreFlag(actor: SessionUser, flag: Flag): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.flag.update({ where: { id: flag.id }, data: { archivedAt: null } });
    await tx.flagEnvironment.updateMany({ where: { flagId: flag.id }, data: { isOn: false } });
    await tx.flagHistory.create({ data: { flagId: flag.id, userId: actor.id, userName: actor.name, change: "restored (off everywhere)" } });
    await writeLog(tx, actor, { action: "restored", targetType: "Flag", target: flag.key });
  });

  await publishFlagChange(environmentIdsOf(flag));
}

export async function deleteFlag(actor: SessionUser, flag: Flag): Promise<void> {
  if (!flag.archivedAt) {
    throw new UserError("Archive the flag first, then delete it.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.flagEnvironment.deleteMany({ where: { flagId: flag.id } });
    await tx.flag.delete({ where: { id: flag.id } });
    await writeLog(tx, actor, { action: "deleted flag", targetType: "Flag", target: flag.key });
  });

  await publishFlagChange(environmentIdsOf(flag));
}
