import { beforeAll, describe, expect, it } from "vitest";
import { createCompany, type TestCompany } from "@/test/factory";
import { assertEnvironmentRole, assertProjectEditor, getAccessibleProjects, getEnvironmentRoles } from "./permissions";

let acme: TestCompany;
let other: TestCompany;

beforeAll(async () => {
  acme = await createCompany();
  other = await createCompany();
});

describe("getEnvironmentRoles", () => {
  it("takes the highest role across all of a user's teams", async () => {
    const roles = await getEnvironmentRoles(acme.devOnly.id);

    expect(roles.get(acme.dev.id)).toBe("EDITOR");
    expect(roles.get(acme.prod.id)).toBe("VIEWER");
  });

  it("is empty for a user with no team", async () => {
    expect((await getEnvironmentRoles(acme.noTeam.id)).size).toBe(0);
  });
});

describe("assertEnvironmentRole", () => {
  it("lets an editor edit", async () => {
    await expect(assertEnvironmentRole(acme.asSessionUser(acme.editor), acme.prod.id, "EDITOR")).resolves.toBeUndefined();
  });

  it("lets a viewer view but not edit", async () => {
    const viewer = acme.asSessionUser(acme.viewer);

    await expect(assertEnvironmentRole(viewer, acme.prod.id, "VIEWER")).resolves.toBeUndefined();
    await expect(assertEnvironmentRole(viewer, acme.prod.id, "EDITOR")).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a user with no team", async () => {
    await expect(assertEnvironmentRole(acme.asSessionUser(acme.noTeam), acme.dev.id, "VIEWER")).rejects.toMatchObject({ status: 403 });
  });

  it("refuses an environment of another company", async () => {
    await expect(assertEnvironmentRole(acme.asSessionUser(acme.editor), other.prod.id, "VIEWER")).rejects.toMatchObject({ status: 403 });
  });

  it("refuses an environment that doesn't exist", async () => {
    await expect(assertEnvironmentRole(acme.asSessionUser(acme.editor), "missing", "VIEWER")).rejects.toMatchObject({ status: 403 });
  });
});

describe("assertProjectEditor", () => {
  it("lets a user who edits any environment of the project in", async () => {
    await expect(assertProjectEditor(acme.asSessionUser(acme.devOnly), acme.project.id)).resolves.toBeUndefined();
  });

  it("refuses a viewer", async () => {
    await expect(assertProjectEditor(acme.asSessionUser(acme.viewer), acme.project.id)).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a company admin with no team", async () => {
    await expect(assertProjectEditor(acme.asSessionUser(acme.admin, "ADMIN"), acme.project.id)).rejects.toMatchObject({ status: 403 });
  });

  it("refuses a project of another company", async () => {
    await expect(assertProjectEditor(acme.asSessionUser(acme.editor), other.project.id)).rejects.toMatchObject({ status: 403 });
  });
});

describe("getAccessibleProjects", () => {
  it("lists only environments the user has a role in", async () => {
    const projects = await getAccessibleProjects(acme.asSessionUser(acme.viewer));

    expect(projects).toHaveLength(1);
    expect(projects[0].environments.map((environment) => [environment.key, environment.role])).toEqual([
      ["dev", "VIEWER"],
      ["prod", "VIEWER"],
    ]);
  });

  it("hides projects the user has no role in", async () => {
    expect(await getAccessibleProjects(acme.asSessionUser(acme.noTeam))).toEqual([]);
  });
});
