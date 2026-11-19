import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createCompany, form, type TestCompany } from "@/test/factory";
import { signInAs } from "@/test/session";
import { deleteContext } from "./actions";

let acme: TestCompany;
let other: TestCompany;

beforeAll(async () => {
  acme = await createCompany();
  other = await createCompany();
});

const createContext = (environmentId: string) =>
  prisma.context.create({
    data: { environmentId, key: `user-${crypto.randomUUID().slice(0, 8)}`, attributes: {}, results: {}, lastSeenAt: new Date() },
    select: { id: true },
  });

const exists = async (id: string) => (await prisma.context.count({ where: { id } })) === 1;

describe("deleteContext", () => {
  it("refuses a viewer", async () => {
    const context = await createContext(acme.prod.id);
    signInAs(acme.viewer);

    expect(await deleteContext({}, form({ contextId: context.id }))).toMatchObject({ error: "You don't have permission to do this." });
    expect(await exists(context.id)).toBe(true);
  });

  it("refuses a context of another company", async () => {
    const context = await createContext(other.prod.id);
    signInAs(acme.editor);

    expect(await deleteContext({}, form({ contextId: context.id }))).toMatchObject({ error: "You don't have permission to do this." });
    expect(await exists(context.id)).toBe(true);
  });

  it("lets an editor delete it, then goes back to the list", async () => {
    const context = await createContext(acme.prod.id);
    signInAs(acme.editor);

    await expect(deleteContext({}, form({ contextId: context.id }))).rejects.toMatchObject({
      digest: expect.stringContaining(`/projects/${acme.project.key}/contexts?env=prod`),
    });
    expect(await exists(context.id)).toBe(false);
  });
});
