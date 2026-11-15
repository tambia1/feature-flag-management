"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState, JsonValue, Rule, SessionUser, Target, Variation } from "@/app/types";
import type { Prisma } from "@/app/generated/prisma/client";
import { runAction, text, UserError } from "@/lib/actions";
import { track } from "@/lib/analytics";
import { writeLog } from "@/lib/audit";
import { describeTargetingChange, type TargetingSnapshot } from "@/lib/flags/describe";
import { formatValue, KEY_PATTERN, parseVariationValue } from "@/lib/flags/values";
import { assertEnvironmentRole, assertProjectEditor } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { publishFlagChange } from "@/lib/pubsub";
import { assertUser, AuthError } from "@/lib/session";

/** Loads a flag inside the user's company, or throws 403. */
async function findFlag(user: SessionUser, flagId: string) {
  const flag = await prisma.flag.findFirst({
    where: { id: flagId, project: { companyId: user.companyId } },
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

const environmentIdsOf = (flag: { project: { environments: { id: string }[] } }) => flag.project.environments.map((item) => item.id);

// ---------- Create ----------

const createSchema = z.object({
  key: z.string().regex(KEY_PATTERN, "Key: lowercase letters, numbers and dashes, e.g. new-checkout").max(64),
  name: z.string().min(1, "Enter a name").max(100),
  description: z.string().max(500),
  type: z.enum(["BOOLEAN", "STRING", "NUMBER", "JSON"]),
});

export async function createFlag(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const user = await assertUser();
    const projectId = text(formData, "projectId");
    await assertProjectEditor(user, projectId);

    const input = createSchema.parse({
      key: text(formData, "key"),
      name: text(formData, "name"),
      description: text(formData, "description"),
      type: text(formData, "type"),
    });

    const rawValues = formData.getAll("variation").map(String);
    const values = rawValues.map((raw) => parseVariationValue(input.type, raw));

    if (values.length < 2) {
      throw new UserError("Add at least two variations");
    }

    if (new Set(values.map((value) => JSON.stringify(value))).size !== values.length) {
      throw new UserError("Variations must be different from each other");
    }

    const onIndex = Number(text(formData, "onIndex"));
    const offIndex = Number(text(formData, "offIndex"));

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

      // Exists in every environment, OFF everywhere; turn it on per environment.
      await tx.flagEnvironment.createMany({
        data: project.environments.map((environment) => ({
          flagId: flag.id,
          environmentId: environment.id,
          isOn: false,
          offVariationId: off.id,
          targets: [],
          rules: [{ id: "default", clauses: [], serve: { variationId: on.id } }],
        })),
      });

      await tx.flagHistory.create({ data: { flagId: flag.id, userId: user.id, userName: user.name, change: "created flag" } });
      await writeLog(tx, user, { action: "created flag", targetType: "Flag", target: input.key });
    });

    await publishFlagChange(project.environments.map((environment) => environment.id));
    track(user.id, "flag created", { type: input.type });
    redirect(`/projects/${project.key}/flags/${input.key}`);
  });
}

// ---------- Turn on / off ----------

export async function setFlagOn(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const user = await assertUser();
    const flag = await findFlag(user, text(formData, "flagId"));
    const environmentId = text(formData, "environmentId");
    const isOn = text(formData, "isOn") === "true";
    const comment = text(formData, "comment") || null;

    await assertEnvironmentRole(user, environmentId, "EDITOR");

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
          userId: user.id,
          userName: user.name,
          change,
          before: { isOn: current.isOn },
          after: { isOn },
          comment,
        },
      });
      await writeLog(tx, user, {
        action: change,
        targetType: "Flag",
        target: `${flag.key} · ${environment.name}`,
        change: isOn ? "off → on" : "on → off",
        comment,
      });
    });

    await publishFlagChange([environmentId]);
    track(user.id, "flag toggled", { on: isOn });
    refresh();
  });
}

// ---------- Targeting ----------

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

// On/off is saved by its own toggle (setFlagOn); this saves everything else.
const targetingSchema = z.object({
  offVariationId: z.string().min(1),
  targets: z.array(z.object({ variationId: z.string().min(1), keys: z.array(z.string().trim().min(1)).max(1000) })),
  rules: z
    .array(z.object({ id: z.string().min(1), clauses: z.array(clauseSchema), serve: serveSchema }))
    .min(1)
    .refine((rules) => rules.at(-1)?.clauses.length === 0, "The last rule is the default rule and has no conditions")
    .refine((rules) => rules.slice(0, -1).every((rule) => rule.clauses.length > 0), "Every rule except the default needs a condition"),
});

function usedVariationIds(snapshot: z.infer<typeof targetingSchema>): string[] {
  return [
    snapshot.offVariationId,
    ...snapshot.targets.map((target) => target.variationId),
    ...snapshot.rules.flatMap((rule) =>
      "variationId" in rule.serve ? [rule.serve.variationId] : rule.serve.rollout.map((part) => part.variationId),
    ),
  ];
}

export async function saveTargeting(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const user = await assertUser();
    const flag = await findFlag(user, text(formData, "flagId"));
    const environmentId = text(formData, "environmentId");
    const comment = text(formData, "comment") || null;

    await assertEnvironmentRole(user, environmentId, "EDITOR");

    let raw: unknown;
    try {
      raw = JSON.parse(text(formData, "targeting"));
    } catch {
      throw new UserError("Please check the targeting settings.");
    }

    const input = targetingSchema.parse(raw);
    const variationIds = new Set(flag.variations.map((variation) => variation.id));

    if (!usedVariationIds(input).every((id) => variationIds.has(id))) {
      throw new UserError("A rule uses a variation that no longer exists. Reload the page.");
    }

    const environment = await prisma.environment.findUniqueOrThrow({ where: { id: environmentId }, select: { name: true } });

    await prisma.$transaction(async (tx) => {
      const current = await tx.flagEnvironment.findUniqueOrThrow({
        where: { flagId_environmentId: { flagId: flag.id, environmentId } },
        select: { isOn: true, offVariationId: true, targets: true, rules: true },
      });

      const before: TargetingSnapshot = {
        isOn: current.isOn,
        offVariationId: current.offVariationId,
        targets: current.targets as Target[],
        rules: current.rules as Rule[],
      };
      const after: TargetingSnapshot = { ...input, isOn: current.isOn };
      const change = describeTargetingChange(before, after, flag.variations as Variation[]);

      if (change === "no changes") {
        throw new UserError("Nothing to save — no changes.");
      }

      await tx.flagEnvironment.update({
        where: { flagId_environmentId: { flagId: flag.id, environmentId } },
        data: { offVariationId: after.offVariationId, targets: after.targets, rules: after.rules },
      });
      await tx.flagHistory.create({
        data: {
          flagId: flag.id,
          environmentId,
          userId: user.id,
          userName: user.name,
          change,
          before: before as unknown as Prisma.InputJsonValue,
          after: after as unknown as Prisma.InputJsonValue,
          comment,
        },
      });
      await writeLog(tx, user, {
        action: "edited targeting",
        targetType: "Flag",
        target: `${flag.key} · ${environment.name}`,
        change,
        comment,
      });
    });

    await publishFlagChange([environmentId]);
    refresh();
    return { success: "Saved" };
  });
}

// ---------- Settings (all environments) ----------

const settingsSchema = z.object({
  name: z.string().min(1, "Enter a name").max(100),
  description: z.string().max(500),
});

export async function updateFlagSettings(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const user = await assertUser();
    const flag = await findFlag(user, text(formData, "flagId"));
    await assertProjectEditor(user, flag.projectId);

    const input = settingsSchema.parse({ name: text(formData, "name"), description: text(formData, "description") });

    // Existing variations keep their id (rules point to them); new ones are added at the end.
    const existing = flag.variations.map((variation) => ({
      id: variation.id,
      value: parseVariationValue(flag.type, String(formData.get(`variation-${variation.id}`) ?? formatValue(variation.value as JsonValue))),
    }));
    const added = formData
      .getAll("newVariation")
      .map(String)
      .filter((raw) => raw.trim() !== "")
      .map((raw) => parseVariationValue(flag.type, raw));

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
      await tx.flagHistory.create({ data: { flagId: flag.id, userId: user.id, userName: user.name, change } });
      await writeLog(tx, user, { action: "edited flag", targetType: "Flag", target: flag.key, change });
    });

    await publishFlagChange(environmentIdsOf(flag));
    refresh();
    return { success: "Saved" };
  });
}

export async function removeVariation(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const user = await assertUser();
    const flag = await findFlag(user, text(formData, "flagId"));
    await assertProjectEditor(user, flag.projectId);

    const variation = flag.variations.find((item) => item.id === text(formData, "variationId"));

    if (!variation) {
      throw new UserError("This variation no longer exists.");
    }

    if (flag.variations.length <= 2) {
      throw new UserError("A flag needs at least two variations.");
    }

    const environments = await prisma.flagEnvironment.findMany({
      where: { flagId: flag.id },
      select: { offVariationId: true, targets: true, rules: true },
    });

    const inUse = environments.some(
      (environment) =>
        environment.offVariationId === variation.id ||
        JSON.stringify([environment.targets, environment.rules]).includes(`"${variation.id}"`),
    );

    if (inUse) {
      throw new UserError("This variation is used as an off value or in a rule. Change those first.");
    }

    const change = `removed variation ${formatValue(variation.value as JsonValue)}`;

    await prisma.$transaction(async (tx) => {
      await tx.variation.delete({ where: { id: variation.id } });
      await tx.flagHistory.create({ data: { flagId: flag.id, userId: user.id, userName: user.name, change } });
      await writeLog(tx, user, { action: "edited flag", targetType: "Flag", target: flag.key, change });
    });

    refresh();
  });
}

// ---------- Archive / restore / delete ----------

export async function archiveFlag(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const user = await assertUser();
    const flag = await findFlag(user, text(formData, "flagId"));
    await assertProjectEditor(user, flag.projectId);

    await prisma.$transaction(async (tx) => {
      await tx.flag.update({ where: { id: flag.id }, data: { archivedAt: new Date() } });
      await tx.flagHistory.create({ data: { flagId: flag.id, userId: user.id, userName: user.name, change: "archived" } });
      await writeLog(tx, user, { action: "archived", targetType: "Flag", target: flag.key });
    });

    await publishFlagChange(environmentIdsOf(flag));
    track(user.id, "flag archived");
    redirect(`/projects/${flag.project.key}/archived`);
  });
}

export async function restoreFlag(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const user = await assertUser();
    const flag = await findFlag(user, text(formData, "flagId"));
    await assertProjectEditor(user, flag.projectId);

    // Back in the list, OFF everywhere.
    await prisma.$transaction(async (tx) => {
      await tx.flag.update({ where: { id: flag.id }, data: { archivedAt: null } });
      await tx.flagEnvironment.updateMany({ where: { flagId: flag.id }, data: { isOn: false } });
      await tx.flagHistory.create({ data: { flagId: flag.id, userId: user.id, userName: user.name, change: "restored (off everywhere)" } });
      await writeLog(tx, user, { action: "restored", targetType: "Flag", target: flag.key });
    });

    await publishFlagChange(environmentIdsOf(flag));
    refresh();
  });
}

export async function deleteFlag(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const user = await assertUser();
    const flag = await findFlag(user, text(formData, "flagId"));
    await assertProjectEditor(user, flag.projectId);

    if (!flag.archivedAt) {
      throw new UserError("Archive the flag first, then delete it.");
    }

    await prisma.$transaction(async (tx) => {
      // FlagEnvironment first: its off value points to a variation (RESTRICT).
      await tx.flagEnvironment.deleteMany({ where: { flagId: flag.id } });
      await tx.flag.delete({ where: { id: flag.id } });
      await writeLog(tx, user, { action: "deleted flag", targetType: "Flag", target: flag.key });
    });

    await publishFlagChange(environmentIdsOf(flag));
    track(user.id, "flag deleted");

    if (text(formData, "from") === "settings") {
      redirect(`/projects/${flag.project.key}/archived`);
    }

    refresh();
  });
}
