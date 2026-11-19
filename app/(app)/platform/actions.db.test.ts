import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createCompany, form, type TestCompany } from "@/test/factory";
import { signInAs } from "@/test/session";
import { createCompany as createCompanyAction, deleteCompany, deleteCompanyUser } from "./actions";

let acme: TestCompany;
let other: TestCompany;

beforeAll(async () => {
  acme = await createCompany();
  other = await createCompany();
});

describe("platform actions", () => {
  it("refuse a company admin who isn't a platform admin", async () => {
    signInAs(acme.admin);

    expect(
      await createCompanyAction({}, form({ name: "Evil Corp", adminName: "Eve", adminEmail: "eve@evil.test", password: "123456" })),
    ).toMatchObject({ error: "You don't have permission to do this." });
    expect(await deleteCompany({}, form({ companyId: other.company.id }))).toMatchObject({
      error: "You don't have permission to do this.",
    });
    expect(await deleteCompanyUser({}, form({ companyId: other.company.id, userId: other.admin.id }))).toMatchObject({
      error: "You don't have permission to do this.",
    });

    expect(await prisma.company.count({ where: { name: "Evil Corp" } })).toBe(0);
    expect(await prisma.company.count({ where: { id: other.company.id } })).toBe(1);
    expect(await prisma.user.count({ where: { id: other.admin.id } })).toBe(1);
  });
});
