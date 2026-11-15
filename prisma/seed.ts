import "dotenv/config";
import { prisma } from "../lib/prisma";
import { createUserWithPassword } from "../lib/users";
import { generateSdkKey } from "../lib/sdk-key";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env");
  }

  let platform = await prisma.company.findFirst({ where: { isPlatform: true } });

  if (!platform) {
    platform = await prisma.company.create({ data: { name: "Our company", isPlatform: true } });
    console.log("Created the platform company");
  }

  if (!(await prisma.user.findUnique({ where: { email } }))) {
    await prisma.$transaction((tx) =>
      createUserWithPassword(tx, { companyId: platform.id, name: "Platform admin", email, role: "ADMIN", password }),
    );
    console.log(`Created platform admin ${email}`);
  }

  if (process.env.SEED_DEMO === "1") {
    await seedDemo(password);
  }
}

async function seedDemo(password: string) {
  if (await prisma.company.findFirst({ where: { name: "Acme" } })) {
    console.log("Demo company already exists");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const acme = await tx.company.create({ data: { name: "Acme" } });

    const emma = await createUserWithPassword(tx, {
      companyId: acme.id,
      name: "Emma Smith",
      email: "emma@acme.com",
      role: "ADMIN",
      password,
    });
    const james = await createUserWithPassword(tx, {
      companyId: acme.id,
      name: "James Brown",
      email: "james@acme.com",
      role: "MEMBER",
      password,
    });
    await createUserWithPassword(tx, { companyId: acme.id, name: "Liam Taylor", email: "liam@acme.com", role: "MEMBER", password });

    const project = await tx.project.create({ data: { companyId: acme.id, name: "Web app", key: "web-app" } });
    const environments = [];

    for (const [name, key] of [
      ["development", "dev"],
      ["staging", "stg"],
      ["production", "prod"],
    ]) {
      environments.push(await tx.environment.create({ data: { projectId: project.id, name, key, sdkKey: generateSdkKey() } }));
    }

    const frontend = await tx.team.create({ data: { companyId: acme.id, name: "Frontend" } });
    const release = await tx.team.create({ data: { companyId: acme.id, name: "Release" } });

    await tx.teamMember.createMany({
      data: [
        { teamId: frontend.id, userId: emma.id },
        { teamId: frontend.id, userId: james.id },
        { teamId: release.id, userId: emma.id },
      ],
    });

    const [dev, stg, prod] = environments;
    await tx.teamEnvironmentRole.createMany({
      data: [
        { teamId: frontend.id, environmentId: dev.id, role: "EDITOR" },
        { teamId: frontend.id, environmentId: stg.id, role: "EDITOR" },
        { teamId: frontend.id, environmentId: prod.id, role: "VIEWER" },
        { teamId: release.id, environmentId: prod.id, role: "EDITOR" },
      ],
    });

    const flags = [
      {
        key: "new-checkout",
        name: "New checkout flow",
        description: "Redesigned one-page checkout",
        type: "BOOLEAN" as const,
        values: [true, false],
      },
      {
        key: "banner-text",
        name: "Homepage banner",
        description: "Text in the homepage banner",
        type: "STRING" as const,
        values: ["Welcome!", "Big sale today!"],
      },
      {
        key: "max-upload-mb",
        name: "Upload limit",
        description: "Max upload size per file (MB)",
        type: "NUMBER" as const,
        values: [100, 25],
      },
      {
        key: "checkout-button-color",
        name: "Checkout button color",
        description: "Color of the Pay button, split between four colors",
        type: "STRING" as const,
        values: ["blue", "green", "orange", "purple"],
      },
    ];

    for (const flag of flags) {
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

      for (const environment of environments) {
        await tx.flagEnvironment.create({
          data: {
            flagId: created.id,
            environmentId: environment.id,
            isOn: environment.key === "dev",
            offVariationId: off.id,
            rules: [{ id: "default", clauses: [], serve }],
          },
        });
      }

      await tx.flagHistory.create({ data: { flagId: created.id, userId: emma.id, userName: emma.name, change: "created flag" } });
    }
  });

  console.log("Created demo company Acme (emma@acme.com, james@acme.com, liam@acme.com — same password as the platform admin)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
