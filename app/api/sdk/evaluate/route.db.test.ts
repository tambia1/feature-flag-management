import { beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createBooleanFlag, createCompany, form, type TestCompany } from "@/test/factory";
import { signInAs } from "@/test/session";
import { saveTargeting, setFlagOn } from "@/app/(app)/projects/[projectKey]/flags/actions";
import { rotateSdkKey } from "@/app/(app)/settings/actions";
import { OPTIONS, POST } from "./route";

let acme: TestCompany;
let flag: Awaited<ReturnType<typeof createBooleanFlag>>;

beforeAll(async () => {
  acme = await createCompany();
  flag = await createBooleanFlag(acme);
});

const evaluate = async (sdkKey: string | null, body: unknown) => {
  const response = await POST(
    new Request("http://localhost/api/sdk/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json", ...(sdkKey ? { authorization: `Bearer ${sdkKey}` } : {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  return { status: response.status, body: await response.json(), cors: response.headers.get("access-control-allow-origin") };
};

const asUser = (key: string, attributes: Record<string, string> = {}) => ({ context: { key, ...attributes } });

describe("POST /api/sdk/evaluate", () => {
  it("needs an SDK key", async () => {
    expect(await evaluate(null, asUser("user-1"))).toMatchObject({
      status: 401,
      body: { error: "Missing SDK key in the Authorization header" },
    });
  });

  it("rejects an unknown SDK key", async () => {
    expect(await evaluate("sdk-unknown", asUser("user-1"))).toMatchObject({ status: 401, body: { error: "Unknown SDK key" } });
  });

  it("rejects a body without a context key", async () => {
    expect(await evaluate(acme.dev.sdkKey, { context: {} })).toMatchObject({ status: 400 });
    expect(await evaluate(acme.dev.sdkKey, "not json")).toMatchObject({ status: 400 });
  });

  it("serves the off value while the flag is off", async () => {
    expect(await evaluate(acme.dev.sdkKey, asUser("user-1"))).toEqual({ status: 200, body: { [flag.key]: false }, cors: "*" });
  });

  it("follows the flag as it is turned on and targeted", async () => {
    const [on, off] = flag.variations.map((variation) => variation.id);
    signInAs(acme.editor);

    await setFlagOn({}, form({ flagId: flag.id, environmentId: acme.prod.id, isOn: "true" }));
    expect((await evaluate(acme.prod.sdkKey, asUser("user-1"))).body).toEqual({ [flag.key]: true });

    await saveTargeting(
      {},
      form({
        flagId: flag.id,
        environmentId: acme.prod.id,
        targeting: JSON.stringify({
          offVariationId: off,
          rules: [
            { id: "beta", clauses: [{ attribute: "plan", operator: "is", values: ["beta"] }], serve: { variationId: on } },
            { id: "default", clauses: [], serve: { variationId: off } },
          ],
        }),
      }),
    );
    expect((await evaluate(acme.prod.sdkKey, asUser("user-1", { plan: "free" }))).body).toEqual({ [flag.key]: false });
    expect((await evaluate(acme.prod.sdkKey, asUser("user-1", { plan: "beta" }))).body).toEqual({ [flag.key]: true });

    expect((await evaluate(acme.dev.sdkKey, asUser("user-1", { plan: "beta" }))).body).toEqual({ [flag.key]: false });
  });

  it("stops accepting the old key after it is rotated", async () => {
    const environment = await prisma.environment.create({
      data: { projectId: acme.project.id, name: "Staging", key: "stg", sdkKey: `sdk-${crypto.randomUUID()}` },
      select: { id: true, sdkKey: true },
    });
    expect((await evaluate(environment.sdkKey, asUser("user-1"))).status).toBe(200);

    signInAs(acme.admin);
    expect(await rotateSdkKey({}, form({ environmentId: environment.id }))).toEqual({});

    expect((await evaluate(environment.sdkKey, asUser("user-1"))).status).toBe(401);
  });

  it("only returns the flags of its own environment", async () => {
    const other = await createCompany();
    const otherFlag = await createBooleanFlag(other);

    expect(Object.keys((await evaluate(acme.dev.sdkKey, asUser("user-1"))).body)).not.toContain(otherFlag.key);
  });

  it("records the context it saw", async () => {
    await evaluate(acme.dev.sdkKey, { context: { key: "recorded-user", country: "DE" }, application: "web" });

    await vi.waitFor(async () => {
      expect(
        await prisma.context.findFirst({
          where: { environmentId: acme.dev.id, key: "recorded-user" },
          select: { application: true, attributes: true },
        }),
      ).toEqual({ application: "web", attributes: { country: "DE" } });
    });
  });
});

describe("OPTIONS /api/sdk/evaluate", () => {
  it("answers the CORS preflight", () => {
    const response = OPTIONS();

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });
});
