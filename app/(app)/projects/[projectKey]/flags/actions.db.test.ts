import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createBooleanFlag, createCompany, flagState, form, type TestCompany } from "@/test/factory";
import { signInAs } from "@/test/session";
import { archiveFlag, createFlag, deleteFlag, restoreFlag, saveTargeting, setFlagOn, updateFlagSettings } from "./actions";

const NO_PERMISSION = { error: "You don't have permission to do this." };

let acme: TestCompany;
let other: TestCompany;

beforeAll(async () => {
  acme = await createCompany();
  other = await createCompany();
});

const toggle = (flagId: string, environmentId: string, isOn = true) => setFlagOn({}, form({ flagId, environmentId, isOn: String(isOn) }));

describe("setFlagOn", () => {
  it("asks a signed-out user to log in", async () => {
    const flag = await createBooleanFlag(acme);

    expect(await toggle(flag.id, acme.prod.id)).toMatchObject({ error: "Please log in again." });
    expect((await flagState(flag.id, acme.prod.id)).isOn).toBe(false);
  });

  it("lets an editor turn a flag on and writes the history and log", async () => {
    const flag = await createBooleanFlag(acme);
    signInAs(acme.editor);

    expect(await toggle(flag.id, acme.prod.id)).toEqual({});
    expect((await flagState(flag.id, acme.prod.id)).isOn).toBe(true);
    expect(await prisma.flagHistory.count({ where: { flagId: flag.id, change: "turned on" } })).toBe(1);
    expect(await prisma.log.count({ where: { companyId: acme.company.id, action: "turned on", target: { startsWith: flag.key } } })).toBe(
      1,
    );
  });

  it("refuses a viewer", async () => {
    const flag = await createBooleanFlag(acme);
    signInAs(acme.viewer);

    expect(await toggle(flag.id, acme.prod.id)).toMatchObject(NO_PERMISSION);
    expect((await flagState(flag.id, acme.prod.id)).isOn).toBe(false);
  });

  it("refuses production to a user who only edits development", async () => {
    const flag = await createBooleanFlag(acme);
    signInAs(acme.devOnly);

    expect(await toggle(flag.id, acme.dev.id)).toEqual({});
    expect(await toggle(flag.id, acme.prod.id)).toMatchObject(NO_PERMISSION);
    expect((await flagState(flag.id, acme.prod.id)).isOn).toBe(false);
  });

  it("refuses a flag of another company", async () => {
    const flag = await createBooleanFlag(other);
    signInAs(acme.editor);

    expect(await toggle(flag.id, acme.prod.id)).toMatchObject(NO_PERMISSION);
    expect(await toggle(flag.id, other.prod.id)).toMatchObject(NO_PERMISSION);
    expect((await flagState(flag.id, other.prod.id)).isOn).toBe(false);
  });

  it("refuses an environment from a different project than the flag", async () => {
    const otherProject = await prisma.project.create({
      data: {
        companyId: acme.company.id,
        name: "Other",
        key: `other-${crypto.randomUUID().slice(0, 8)}`,
        environments: { create: { name: "Development", key: "dev", sdkKey: `sdk-${crypto.randomUUID()}` } },
      },
      select: { environments: { select: { id: true } } },
    });
    await prisma.teamEnvironmentRole.create({
      data: {
        team: { create: { companyId: acme.company.id, name: "Other team", members: { create: { userId: acme.viewer.id } } } },
        environment: { connect: { id: otherProject.environments[0].id } },
        role: "EDITOR",
      },
    });
    const flag = await createBooleanFlag(acme);
    signInAs(acme.viewer);

    expect(await toggle(flag.id, otherProject.environments[0].id)).toMatchObject(NO_PERMISSION);
  });

  it("won't turn on an archived flag", async () => {
    const flag = await createBooleanFlag(acme);
    await prisma.flag.update({ where: { id: flag.id }, data: { archivedAt: new Date() } });
    signInAs(acme.editor);

    expect(await toggle(flag.id, acme.dev.id)).toMatchObject({ error: "Restore the flag before turning it on" });
  });
});

describe("createFlag", () => {
  const newFlag = (key: string) =>
    form({
      projectId: acme.project.id,
      key,
      name: "New flag",
      description: "",
      type: "BOOLEAN",
      variation: ["true", "false"],
      onIndex: "0",
      offIndex: "1",
    });

  it("creates the flag turned off in every environment, then redirects to it", async () => {
    const key = `created-${crypto.randomUUID().slice(0, 8)}`;
    signInAs(acme.devOnly);

    await expect(createFlag({}, newFlag(key))).rejects.toMatchObject({ digest: expect.stringContaining(`/flags/${key}`) });

    const flag = await prisma.flag.findFirstOrThrow({ where: { projectId: acme.project.id, key }, select: { environments: true } });
    expect(flag.environments).toHaveLength(2);
    expect(flag.environments.every((environment) => !environment.isOn)).toBe(true);
  });

  it("refuses a user who can't edit any environment of the project", async () => {
    const key = `refused-${crypto.randomUUID().slice(0, 8)}`;
    signInAs(acme.viewer);

    expect(await createFlag({}, newFlag(key))).toMatchObject(NO_PERMISSION);
    expect(await prisma.flag.count({ where: { key } })).toBe(0);
  });

  it("refuses a project of another company", async () => {
    signInAs(other.editor);

    expect(await createFlag({}, newFlag(`x-${crypto.randomUUID().slice(0, 8)}`))).toMatchObject(NO_PERMISSION);
  });

  it("keeps what the user typed when the key is taken", async () => {
    const existing = await createBooleanFlag(acme);
    signInAs(acme.editor);

    expect(await createFlag({}, newFlag(existing.key))).toEqual({
      error: "That name or key is already used. Pick another one.",
      values: expect.objectContaining({ key: existing.key, name: "New flag" }),
    });
  });
});

describe("saveTargeting", () => {
  const targeting = (on: string, off: string, weights?: [number, number]) => ({
    offVariationId: off,
    rules: [
      { id: "beta", clauses: [{ attribute: "plan", operator: "is", values: ["beta"] }], serve: { variationId: on } },
      {
        id: "default",
        clauses: [],
        serve: weights
          ? {
              rollout: [
                { variationId: on, weight: weights[0] },
                { variationId: off, weight: weights[1] },
              ],
            }
          : { variationId: off },
      },
    ],
  });

  const save = (flagId: string, environmentId: string, value: unknown) =>
    saveTargeting({}, form({ flagId, environmentId, targeting: JSON.stringify(value), comment: "beta users" }));

  it("saves the rules and records the change with the comment", async () => {
    const flag = await createBooleanFlag(acme);
    const [on, off] = flag.variations.map((variation) => variation.id);
    signInAs(acme.editor);

    expect(await save(flag.id, acme.prod.id, targeting(on, off))).toEqual({ success: "Saved" });
    expect((await flagState(flag.id, acme.prod.id)).rules).toEqual(targeting(on, off).rules);
    expect(
      await prisma.flagHistory.findFirst({ where: { flagId: flag.id, environmentId: acme.prod.id }, select: { comment: true } }),
    ).toEqual({
      comment: "beta users",
    });
  });

  it("refuses a viewer", async () => {
    const flag = await createBooleanFlag(acme);
    const [on, off] = flag.variations.map((variation) => variation.id);
    signInAs(acme.viewer);

    expect(await save(flag.id, acme.prod.id, targeting(on, off))).toMatchObject(NO_PERMISSION);
    expect((await flagState(flag.id, acme.prod.id)).rules).not.toEqual(targeting(on, off).rules);
  });

  it("rejects a rollout that doesn't add up to 100", async () => {
    const flag = await createBooleanFlag(acme);
    const [on, off] = flag.variations.map((variation) => variation.id);
    signInAs(acme.editor);

    expect(await save(flag.id, acme.dev.id, targeting(on, off, [60, 30]))).toMatchObject({
      error: "Rollout percentages must add up to 100",
    });
  });

  it("rejects a variation that belongs to another flag", async () => {
    const flag = await createBooleanFlag(acme);
    const stranger = await createBooleanFlag(acme);
    signInAs(acme.editor);

    expect(await save(flag.id, acme.dev.id, targeting(stranger.variations[0].id, flag.variations[1].id))).toMatchObject({
      error: "A rule uses a variation that no longer exists. Reload the page.",
    });
  });

  it("rejects targeting that isn't JSON", async () => {
    const flag = await createBooleanFlag(acme);
    signInAs(acme.editor);

    expect(await saveTargeting({}, form({ flagId: flag.id, environmentId: acme.dev.id, targeting: "{" }))).toMatchObject({
      error: "Please check the targeting settings.",
    });
  });
});

describe("archive, restore and delete", () => {
  it("refuses a viewer", async () => {
    const flag = await createBooleanFlag(acme);
    signInAs(acme.viewer);

    expect(await archiveFlag({}, form({ flagId: flag.id }))).toMatchObject(NO_PERMISSION);
    expect(await updateFlagSettings({}, form({ flagId: flag.id, name: "Renamed", description: "" }))).toMatchObject(NO_PERMISSION);
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id }, select: { archivedAt: true, name: true } })).toEqual({
      archivedAt: null,
      name: "Test flag",
    });
  });

  it("only deletes a flag after it is archived", async () => {
    const flag = await createBooleanFlag(acme);
    signInAs(acme.editor);

    expect(await deleteFlag({}, form({ flagId: flag.id }))).toMatchObject({ error: "Archive the flag first, then delete it." });

    await expect(archiveFlag({}, form({ flagId: flag.id }))).rejects.toMatchObject({ digest: expect.stringContaining("/archived") });
    expect(await deleteFlag({}, form({ flagId: flag.id }))).toEqual({});
    expect(await prisma.flag.count({ where: { id: flag.id } })).toBe(0);
  });

  it("restores a flag turned off everywhere", async () => {
    const flag = await createBooleanFlag(acme);
    signInAs(acme.editor);
    await toggle(flag.id, acme.prod.id);
    await prisma.flag.update({ where: { id: flag.id }, data: { archivedAt: new Date() } });

    expect(await restoreFlag({}, form({ flagId: flag.id }))).toEqual({});
    expect((await flagState(flag.id, acme.prod.id)).isOn).toBe(false);
  });
});
