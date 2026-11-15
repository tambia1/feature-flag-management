import { describe, expect, it } from "vitest";
import { highestRole, roleAllows } from "./roles";

describe("roles", () => {
  it("picks the highest role from all teams", () => {
    expect(highestRole([])).toBe("NONE");
    expect(highestRole(["VIEWER", "NONE"])).toBe("VIEWER");
    expect(highestRole(["VIEWER", "EDITOR", "VIEWER"])).toBe("EDITOR");
  });

  it("editor allows viewer actions, not the other way round", () => {
    expect(roleAllows("EDITOR", "VIEWER")).toBe(true);
    expect(roleAllows("VIEWER", "EDITOR")).toBe(false);
    expect(roleAllows("NONE", "VIEWER")).toBe(false);
  });
});
