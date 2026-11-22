import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createCompany, type TestCompany } from "@/test/factory";
import { getConnectedApps, getSdkConnections } from "./connected-apps";
import { trackStream } from "./streams";

let acme: TestCompany;
let other: TestCompany;
let untrack: (() => void)[] = [];

beforeAll(async () => {
  acme = await createCompany();
  other = await createCompany();
});

afterEach(() => {
  untrack.forEach((close) => close());
  untrack = [];
});

const open = (environmentId: string, applicationName: string, count: number) => {
  for (let i = 0; i < count; i++) {
    untrack.push(trackStream(environmentId, applicationName));
  }
};

describe("getSdkConnections", () => {
  it("lists every open SDK connection with its company, project and environment, busiest first", async () => {
    open(acme.prod.id, "web", 3);
    open(acme.dev.id, "", 1);
    open(other.prod.id, "ios", 2);

    const { connections } = await getSdkConnections();
    const ours = connections.filter((row) => [acme.company.id, other.company.id].includes(row.companyId));

    expect(ours).toEqual([
      {
        companyId: acme.company.id,
        companyName: acme.company.name,
        projectName: "Web app",
        environmentName: "Production",
        applicationName: "web",
        connections: 3,
      },
      {
        companyId: other.company.id,
        companyName: other.company.name,
        projectName: "Web app",
        environmentName: "Production",
        applicationName: "ios",
        connections: 2,
      },
      {
        companyId: acme.company.id,
        companyName: acme.company.name,
        projectName: "Web app",
        environmentName: "Development",
        applicationName: "",
        connections: 1,
      },
    ]);
  });

  it("totals each company, including companies with nothing connected", async () => {
    open(acme.prod.id, "web", 2);
    open(acme.dev.id, "web", 1);

    const { companies } = await getSdkConnections();

    expect(companies.find((company) => company.companyId === acme.company.id)).toMatchObject({ connections: 3, apps: 2 });
    expect(companies.find((company) => company.companyId === other.company.id)).toMatchObject({ connections: 0, apps: 0 });
  });

  it("skips streams for an environment that no longer exists", async () => {
    open("deleted-environment", "web", 1);

    const { connections } = await getSdkConnections();

    expect(connections).toEqual([]);
  });
});

describe("getConnectedApps", () => {
  it("counts the apps of one environment only", async () => {
    open(acme.prod.id, "web", 2);
    open(acme.prod.id, "ios", 1);
    open(acme.dev.id, "web", 4);

    expect(await getConnectedApps(acme.prod.id)).toEqual([
      { applicationName: "web", connections: 2 },
      { applicationName: "ios", connections: 1 },
    ]);
  });
});
