import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createCompany, form, type TestCompany } from "@/test/factory";
import { signInAs } from "@/test/session";
import { createProject, deleteProject, deleteUser, renameTeam, rotateSdkKey, saveTeamPermissions } from "./actions";

const NO_PERMISSION = { error: "You don't have permission to do this." };

let acme: TestCompany;
let other: TestCompany;
let acmeTeam: { id: string };
let otherTeam: { id: string };

beforeAll(async () => {
  acme = await createCompany();
  other = await createCompany();
  acmeTeam = await prisma.team.create({ data: { companyId: acme.company.id, name: "Support" }, select: { id: true } });
  otherTeam = await prisma.team.create({ data: { companyId: other.company.id, name: "Support" }, select: { id: true } });
});

const sdkKeyOf = async (environmentId: string) =>
  (await prisma.environment.findUniqueOrThrow({ where: { id: environmentId }, select: { sdkKey: true } })).sdkKey;

describe("company admin actions", () => {
  it("refuse a member, even one who edits every environment", async () => {
    signInAs(acme.editor);
    const before = await sdkKeyOf(acme.prod.id);

    expect(await createProject({}, form({ name: "Sneaky", key: "sneaky" }))).toMatchObject(NO_PERMISSION);
    expect(await rotateSdkKey({}, form({ environmentId: acme.prod.id }))).toMatchObject(NO_PERMISSION);
    expect(await deleteUser({}, form({ userId: acme.viewer.id }))).toMatchObject(NO_PERMISSION);
    expect(await saveTeamPermissions({}, form({ teamId: acmeTeam.id, [`role-${acme.prod.id}`]: "EDITOR" }))).toMatchObject(NO_PERMISSION);

    expect(await prisma.project.count({ where: { companyId: acme.company.id, key: "sneaky" } })).toBe(0);
    expect(await sdkKeyOf(acme.prod.id)).toBe(before);
    expect(await prisma.user.count({ where: { id: acme.viewer.id } })).toBe(1);
    expect(await prisma.teamEnvironmentRole.count({ where: { teamId: acmeTeam.id } })).toBe(0);
  });

  it("refuse a signed-out user", async () => {
    expect(await createProject({}, form({ name: "Sneaky", key: "sneaky" }))).toMatchObject({ error: "Please log in again." });
  });

  it("let an admin create a project", async () => {
    signInAs(acme.admin);

    expect(await createProject({}, form({ name: "Mobile", key: "mobile" }))).toEqual({ success: "Added Mobile" });
    expect(await prisma.project.count({ where: { companyId: acme.company.id, key: "mobile" } })).toBe(1);
  });

  it("let an admin give a team a role", async () => {
    signInAs(acme.admin);

    expect(
      await saveTeamPermissions({}, form({ teamId: acmeTeam.id, [`role-${acme.dev.id}`]: "VIEWER", [`role-${acme.prod.id}`]: "NONE" })),
    ).toEqual({ success: "Saved" });
    expect(
      await prisma.teamEnvironmentRole.findMany({ where: { teamId: acmeTeam.id }, select: { environmentId: true, role: true } }),
    ).toEqual([{ environmentId: acme.dev.id, role: "VIEWER" }]);
  });

  it("don't let an admin touch another company", async () => {
    signInAs(acme.admin);
    const before = await sdkKeyOf(other.prod.id);

    expect(await renameTeam({}, form({ teamId: otherTeam.id, name: "Hijacked" }))).toMatchObject(NO_PERMISSION);
    expect(await saveTeamPermissions({}, form({ teamId: otherTeam.id }))).toMatchObject(NO_PERMISSION);
    expect(await deleteProject({}, form({ projectId: other.project.id }))).toMatchObject(NO_PERMISSION);
    expect(await rotateSdkKey({}, form({ environmentId: other.prod.id }))).toMatchObject(NO_PERMISSION);
    expect(await deleteUser({}, form({ userId: other.admin.id }))).toMatchObject(NO_PERMISSION);

    expect(await prisma.team.findUniqueOrThrow({ where: { id: otherTeam.id }, select: { name: true } })).toEqual({ name: "Support" });
    expect(await prisma.project.count({ where: { id: other.project.id } })).toBe(1);
    expect(await sdkKeyOf(other.prod.id)).toBe(before);
    expect(await prisma.user.count({ where: { id: other.admin.id } })).toBe(1);
  });

  it("don't let an admin delete themselves", async () => {
    signInAs(acme.admin);

    expect(await deleteUser({}, form({ userId: acme.admin.id }))).toMatchObject({ error: "You can't delete yourself. Ask another admin." });
  });
});
