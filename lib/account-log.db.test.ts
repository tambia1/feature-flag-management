import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createCompany, type TestCompany } from "@/test/factory";
import { describeDevice, logAccountEvent } from "./account-log";

const CHROME_ON_LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const SAFARI_ON_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const EDGE_ON_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0";

let acme: TestCompany;

beforeAll(async () => {
  acme = await createCompany();
});

const logsOf = (userId: string) =>
  prisma.log.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { companyId: true, userEmail: true, action: true, targetType: true, target: true, change: true },
  });

describe("describeDevice", () => {
  it("names the IP address, browser and system", () => {
    expect(describeDevice({ ipAddress: "203.0.113.7", userAgent: CHROME_ON_LINUX })).toBe("203.0.113.7 · Chrome on Linux");
    expect(describeDevice({ ipAddress: "203.0.113.7", userAgent: SAFARI_ON_IPHONE })).toBe("203.0.113.7 · Safari on iOS");
    expect(describeDevice({ ipAddress: "203.0.113.7", userAgent: EDGE_ON_WINDOWS })).toBe("203.0.113.7 · Edge on Windows");
  });

  it("says when the IP address or browser is unknown", () => {
    expect(describeDevice({ ipAddress: null, userAgent: null })).toBe("Unknown IP");
    expect(describeDevice({ ipAddress: "", userAgent: "curl/8.9.1" })).toBe("Unknown IP · Other browser");
    expect(describeDevice({ ipAddress: "0000:0000:0000:0000:0000:0000:0000:0000", userAgent: CHROME_ON_LINUX })).toBe(
      "Unknown IP · Chrome on Linux",
    );
  });
});

describe("logAccountEvent", () => {
  it("writes sign-ins, sign-outs and password changes to the user's company log", async () => {
    const device = { ipAddress: "203.0.113.7", userAgent: CHROME_ON_LINUX };

    await logAccountEvent(acme.editor.id, "signed in", device);
    await logAccountEvent(acme.editor.id, "changed password", device);
    await logAccountEvent(acme.editor.id, "signed out", device);

    const email = (await prisma.user.findUniqueOrThrow({ where: { id: acme.editor.id }, select: { email: true } })).email;
    const entry = {
      companyId: acme.company.id,
      userEmail: email,
      targetType: "User",
      target: email,
      change: "203.0.113.7 · Chrome on Linux",
    };

    expect(await logsOf(acme.editor.id)).toEqual([
      { ...entry, action: "signed in" },
      { ...entry, action: "changed password" },
      { ...entry, action: "signed out" },
    ]);
  });

  it("writes nothing for a user that doesn't exist, and doesn't throw", async () => {
    await expect(logAccountEvent("no-such-user", "signed in", {})).resolves.toBeUndefined();
    expect(await logsOf("no-such-user")).toEqual([]);
  });
});
