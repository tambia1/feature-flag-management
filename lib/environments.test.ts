import { describe, expect, it } from "vitest";
import { isProduction, projectKeyFromPath } from "./environments";

describe("isProduction", () => {
  it.each([
    [{ key: "prod", name: "Live" }, true],
    [{ key: "production", name: "Live" }, true],
    [{ key: "live", name: "Production" }, true],
    [{ key: "dev", name: "development" }, false],
    [{ key: "preprod", name: "Pre-production" }, false],
  ])("%o → %s", (environment, expected) => {
    expect(isProduction(environment)).toBe(expected);
  });
});

describe("projectKeyFromPath", () => {
  it("reads the project key from a project page", () => {
    expect(projectKeyFromPath("/projects/web-app/flags/new-checkout")).toBe("web-app");
    expect(projectKeyFromPath("/projects/web-app")).toBe("web-app");
  });

  it("is null outside a project", () => {
    expect(projectKeyFromPath("/settings/projects")).toBeNull();
    expect(projectKeyFromPath("/")).toBeNull();
  });
});
