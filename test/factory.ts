import type { CompanyRole, EnvironmentRole, SessionUser } from "@/app/types";
import { createFlag } from "@/lib/flags/flags";
import { prisma } from "@/lib/prisma";
import { generateSdkKey } from "@/lib/sdk-key";

const unique = () => crypto.randomUUID().slice(0, 8);

async function createUser(companyId: string, name: string, role: CompanyRole = "MEMBER") {
  return prisma.user.create({
    data: { companyId, name, email: `${name.toLowerCase()}-${unique()}@test.local`, role },
    select: { id: true },
  });
}

async function createTeam(companyId: string, userIds: string[], roles: { environmentId: string; role: EnvironmentRole }[]) {
  return prisma.team.create({
    data: {
      companyId,
      name: `Team ${unique()}`,
      members: { create: userIds.map((userId) => ({ userId })) },
      roles: { create: roles },
    },
    select: { id: true },
  });
}

export async function createCompany() {
  const company = await prisma.company.create({ data: { name: `Company ${unique()}` }, select: { id: true, name: true } });
  const project = await prisma.project.create({
    data: {
      companyId: company.id,
      name: "Web app",
      key: `web-${unique()}`,
      environments: {
        create: [
          { name: "Development", key: "dev", sdkKey: generateSdkKey() },
          { name: "Production", key: "prod", sdkKey: generateSdkKey() },
        ],
      },
    },
    select: { id: true, key: true, environments: { orderBy: { key: "asc" }, select: { id: true, key: true, sdkKey: true } } },
  });
  const [dev, prod] = project.environments;

  const admin = await createUser(company.id, "Admin", "ADMIN");
  const editor = await createUser(company.id, "Editor");
  const viewer = await createUser(company.id, "Viewer");
  const devOnly = await createUser(company.id, "DevOnly");
  const noTeam = await createUser(company.id, "NoTeam");

  await createTeam(
    company.id,
    [editor.id],
    [
      { environmentId: dev.id, role: "EDITOR" },
      { environmentId: prod.id, role: "EDITOR" },
    ],
  );
  await createTeam(
    company.id,
    [viewer.id, devOnly.id],
    [
      { environmentId: dev.id, role: "VIEWER" },
      { environmentId: prod.id, role: "VIEWER" },
    ],
  );
  await createTeam(company.id, [devOnly.id], [{ environmentId: dev.id, role: "EDITOR" }]);

  const asSessionUser = (user: { id: string }, role: CompanyRole = "MEMBER"): SessionUser => ({
    id: user.id,
    name: "Test user",
    email: "test@test.local",
    role,
    companyId: company.id,
    companyName: company.name,
    companyIconUrl: null,
    isPlatformAdmin: false,
  });

  return {
    company,
    project,
    dev,
    prod,
    admin,
    editor,
    viewer,
    devOnly,
    noTeam,
    asSessionUser,
  };
}

export type TestCompany = Awaited<ReturnType<typeof createCompany>>;

export async function createBooleanFlag(world: TestCompany) {
  const key = `flag-${unique()}`;

  await createFlag(world.asSessionUser(world.admin, "ADMIN"), world.project.id, {
    key,
    name: "Test flag",
    description: "",
    type: "BOOLEAN",
    variations: ["true", "false"],
    onIndex: 0,
    offIndex: 1,
  });

  return prisma.flag.findFirstOrThrow({
    where: { projectId: world.project.id, key },
    select: { id: true, key: true, variations: { orderBy: { order: "asc" }, select: { id: true, value: true } } },
  });
}

export function form(values: Record<string, string | string[]>): FormData {
  const data = new FormData();

  for (const [name, value] of Object.entries(values)) {
    for (const item of [value].flat()) {
      data.append(name, item);
    }
  }

  return data;
}

export async function flagState(flagId: string, environmentId: string) {
  return prisma.flagEnvironment.findUniqueOrThrow({
    where: { flagId_environmentId: { flagId, environmentId } },
    select: { isOn: true, offVariationId: true, rules: true },
  });
}
