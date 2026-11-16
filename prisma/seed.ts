import "dotenv/config";
import { prisma, type Tx } from "../lib/prisma";
import { createUserWithPassword } from "../lib/users";
import { generateSdkKey } from "../lib/sdk-key";
import type { CompanyRole, EnvironmentRole, FlagType } from "../app/types";

const PASSWORD = "1234";

type SeedProject = {
  project: { name: string; key: string };
  environments: { name: string; key: string; sdkKey?: string }[];
  teams: { name: string; roles: Record<string, EnvironmentRole> }[];
  flags: { key: string; name: string; description: string; type: FlagType; values: (boolean | string | number)[] }[];
};

type DemoCompany = SeedProject & {
  name: string;
  iconUrl: string;
  iconThumbUrl: string;
  users: { name: string; email: string; role: CompanyRole; teams: string[] }[];
};

type SeedUser = { id: string; name: string; teams: string[] };

const platformProject: SeedProject = {
  project: { name: "Platform Project", key: "platform-project" },
  environments: [
    { name: "Development", key: "development", sdkKey: process.env.NEXT_PUBLIC_FLAGS_SDK_KEY },
    { name: "Staging", key: "staging" },
    { name: "Production", key: "production" },
  ],
  teams: [{ name: "Developers", roles: { development: "EDITOR", staging: "EDITOR", production: "EDITOR" } }],
  flags: [
    {
      key: "test",
      name: "Test",
      description: "Flag for testing the SDK",
      type: "BOOLEAN",
      values: [true, false],
    },
  ],
};

const demoCompanies: DemoCompany[] = [
  {
    name: "Acme",
    iconUrl: "https://api.dicebear.com/9.x/shapes/png?seed=Acme&size=1024",
    iconThumbUrl: "https://api.dicebear.com/9.x/shapes/png?seed=Acme&size=64",
    users: [
      { name: "Emma Smith", email: "emma@acme.com", role: "ADMIN", teams: ["Frontend", "Release"] },
      { name: "James Brown", email: "james@acme.com", role: "MEMBER", teams: ["Frontend"] },
      { name: "Liam Taylor", email: "liam@acme.com", role: "MEMBER", teams: [] },
    ],
    project: { name: "Web app", key: "web-app" },
    environments: [
      { name: "development", key: "dev" },
      { name: "staging", key: "stg" },
      { name: "production", key: "prod" },
    ],
    teams: [
      { name: "Frontend", roles: { dev: "EDITOR", stg: "EDITOR", prod: "VIEWER" } },
      { name: "Release", roles: { prod: "EDITOR" } },
    ],
    flags: [
      {
        key: "new-checkout",
        name: "New checkout flow",
        description: "Redesigned one-page checkout",
        type: "BOOLEAN",
        values: [true, false],
      },
      {
        key: "banner-text",
        name: "Homepage banner",
        description: "Text in the homepage banner",
        type: "STRING",
        values: ["Welcome!", "Big sale today!"],
      },
      {
        key: "max-upload-mb",
        name: "Upload limit",
        description: "Max upload size per file (MB)",
        type: "NUMBER",
        values: [100, 25],
      },
      {
        key: "checkout-button-color",
        name: "Checkout button color",
        description: "Color of the Pay button, split between four colors",
        type: "STRING",
        values: ["blue", "green", "orange", "purple"],
      },
    ],
  },
  {
    name: "Nova",
    iconUrl: "https://api.dicebear.com/9.x/shapes/png?seed=Nova&size=1024",
    iconThumbUrl: "https://api.dicebear.com/9.x/shapes/png?seed=Nova&size=64",
    users: [
      { name: "Olivia Green", email: "olivia@nova.com", role: "ADMIN", teams: ["Mobile", "QA"] },
      { name: "Noah Wilson", email: "noah@nova.com", role: "MEMBER", teams: ["Mobile"] },
      { name: "Mia Clark", email: "mia@nova.com", role: "MEMBER", teams: ["QA"] },
    ],
    project: { name: "Mobile app", key: "mobile-app" },
    environments: [
      { name: "development", key: "dev" },
      { name: "production", key: "prod" },
    ],
    teams: [
      { name: "Mobile", roles: { dev: "EDITOR", prod: "EDITOR" } },
      { name: "QA", roles: { dev: "EDITOR", prod: "VIEWER" } },
    ],
    flags: [
      {
        key: "dark-mode",
        name: "Dark mode",
        description: "Let users switch the app to a dark theme",
        type: "BOOLEAN",
        values: [true, false],
      },
      {
        key: "onboarding-steps",
        name: "Onboarding steps",
        description: "Number of screens in the first-run onboarding",
        type: "NUMBER",
        values: [3, 5],
      },
      {
        key: "home-layout",
        name: "Home screen layout",
        description: "Layout of the home screen, split between three designs",
        type: "STRING",
        values: ["grid", "list", "cards"],
      },
    ],
  },
];

async function main() {
  let platform = await prisma.company.findFirst({ where: { isPlatform: true }, select: { id: true } });

  if (!platform) {
    platform = await prisma.company.create({ data: { name: "Platform", isPlatform: true }, select: { id: true } });
    console.log("Created the platform company");
  }

  const platformId = platform.id;

  let admin = await prisma.user.findUnique({ where: { email: "a@a.com" }, select: { id: true, name: true } });

  if (!admin) {
    admin = await prisma.$transaction((tx) =>
      createUserWithPassword(tx, { companyId: platformId, name: "admin", email: "a@a.com", role: "ADMIN", password: PASSWORD }),
    );
    console.log("Created platform admin a@a.com");
  }

  const platformAdmin = { ...admin, teams: platformProject.teams.map((team) => team.name) };

  if (await prisma.project.findFirst({ where: { companyId: platformId, key: platformProject.project.key }, select: { id: true } })) {
    console.log(`${platformProject.project.name} already exists`);
  } else {
    await prisma.$transaction((tx) => seedProject(tx, platformId, [platformAdmin], platformProject));
    console.log(`Created ${platformProject.project.name} with team Developers (a@a.com)`);
  }

  if (process.env.SEED_DEMO === "1") {
    for (const company of demoCompanies) {
      await seedDemoCompany(company);
    }
  }
}

async function seedDemoCompany(demo: DemoCompany) {
  if (await prisma.company.findFirst({ where: { name: demo.name }, select: { id: true } })) {
    console.log(`Demo company ${demo.name} already exists`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: demo.name, iconUrl: demo.iconUrl, iconThumbUrl: demo.iconThumbUrl },
      select: { id: true },
    });

    const users = [];
    for (const user of demo.users) {
      users.push({
        ...(await createUserWithPassword(tx, {
          companyId: company.id,
          name: user.name,
          email: user.email,
          role: user.role,
          password: PASSWORD,
        })),
        teams: user.teams,
      });
    }

    await seedProject(tx, company.id, users, demo);
  });

  console.log(`Created demo company ${demo.name} (${demo.users.map((user) => user.email).join(", ")})`);
}

async function seedProject(tx: Tx, companyId: string, users: SeedUser[], seed: SeedProject) {
  const project = await tx.project.create({
    data: { companyId, name: seed.project.name, key: seed.project.key },
    select: { id: true },
  });

  const environments = [];
  for (const environment of seed.environments) {
    environments.push(
      await tx.environment.create({
        data: { projectId: project.id, name: environment.name, key: environment.key, sdkKey: environment.sdkKey || generateSdkKey() },
        select: { id: true, key: true },
      }),
    );
  }

  for (const team of seed.teams) {
    const created = await tx.team.create({ data: { companyId, name: team.name }, select: { id: true } });

    await tx.teamMember.createMany({
      data: users.filter((user) => user.teams.includes(team.name)).map((user) => ({ teamId: created.id, userId: user.id })),
    });

    await tx.teamEnvironmentRole.createMany({
      data: environments
        .filter((environment) => team.roles[environment.key])
        .map((environment) => ({ teamId: created.id, environmentId: environment.id, role: team.roles[environment.key] })),
    });
  }

  const admin = users[0];

  for (const flag of seed.flags) {
    const created = await tx.flag.create({
      data: {
        projectId: project.id,
        key: flag.key,
        name: flag.name,
        description: flag.description,
        type: flag.type,
        variations: { create: flag.values.map((value, order) => ({ value, order })) },
      },
      select: { id: true, variations: { orderBy: { order: "asc" }, select: { id: true } } },
    });

    const [on, off] = created.variations;
    const serve =
      created.variations.length > 2
        ? {
            rollout: created.variations.map((variation, index, all) => ({
              variationId: variation.id,
              weight: Math.floor(100 / all.length) + (index < 100 % all.length ? 1 : 0),
            })),
          }
        : { variationId: on.id };

    for (const [index, environment] of environments.entries()) {
      await tx.flagEnvironment.create({
        data: {
          flagId: created.id,
          environmentId: environment.id,
          isOn: index === 0,
          offVariationId: off.id,
          rules: [{ id: "default", clauses: [], serve }],
        },
      });
    }

    await tx.flagHistory.create({ data: { flagId: created.id, userId: admin.id, userName: admin.name, change: "created flag" } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
