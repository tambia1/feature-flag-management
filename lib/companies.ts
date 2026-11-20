import "server-only";
import { z } from "zod";
import type { CompanyActivity, SessionUser } from "@/app/types";
import { deleteIconFiles, prepareIcon, removeCompanyIcon, setCompanyIcon, storeIcon } from "@/lib/company-icon";
import { UserError } from "@/lib/errors";
import { nameField } from "@/lib/fields";
import { type LogWriter, writePlatformLog } from "@/lib/logs";
import { prisma } from "@/lib/prisma";
import { publishFlagChange } from "@/lib/pubsub";
import { AuthError } from "@/lib/session";
import { slackWebhookField } from "@/lib/slack";
import { createUserWithPassword } from "@/lib/users";

const MONTHS = 12;

export async function getCompanyActivity(companyId: string, now = new Date()): Promise<CompanyActivity> {
  const starts = Array.from(
    { length: MONTHS },
    (_, index) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1 - index), 1)),
  );
  const ends = starts.map((start) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)));

  const [users, projects, teams, operations] = await Promise.all([
    prisma.user.findMany({ where: { companyId }, select: { createdAt: true } }),
    prisma.project.findMany({ where: { companyId }, select: { createdAt: true } }),
    prisma.team.findMany({ where: { companyId }, select: { createdAt: true } }),
    prisma.$queryRaw<{ month: Date; count: number }[]>`
      SELECT date_trunc('month', "createdAt") AS month, count(*)::int AS count
      FROM logs
      WHERE "companyId" = ${companyId} AND "createdAt" >= ${starts[0]}
      GROUP BY 1`,
  ]);

  const existingAt = (rows: { createdAt: Date }[]) => ends.map((end) => rows.filter((row) => row.createdAt < end).length);

  return {
    months: starts.map((start) => start.toLocaleDateString("en", { month: "short", year: "numeric", timeZone: "UTC" })),
    series: [
      { key: "users", label: "Users", values: existingAt(users) },
      { key: "projects", label: "Projects", values: existingAt(projects) },
      { key: "teams", label: "Teams", values: existingAt(teams) },
      {
        key: "operations",
        label: "Operations",
        values: starts.map((start) => operations.find((row) => row.month.getTime() === start.getTime())?.count ?? 0),
      },
    ],
  };
}

type Company = { id: string; name: string };

type NewCompany = { name: string; adminName: string; adminEmail: string; password: string };

type CompanyChanges = { name: string; icon: File | null; removeIcon: boolean; slackWebhookUrl?: string };

const companyName = nameField("a company name");

const newCompanySchema = z.object({
  name: companyName,
  adminName: nameField("the admin's name"),
  adminEmail: z.email("Enter a valid email").max(200),
  password: z.string().min(4, "Password: at least 4 characters").max(128),
});

export async function findCompany(companyId: string): Promise<Company> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });
  if (!company) throw new AuthError(403);
  return company;
}

export async function createCompany(actor: SessionUser, newCompany: NewCompany, iconFile: File | null): Promise<string> {
  const input = newCompanySchema.parse(newCompany);

  if (await prisma.user.findUnique({ where: { email: input.adminEmail.toLowerCase() }, select: { id: true } })) {
    throw new UserError("A user with this email already exists.");
  }

  const icon = iconFile && iconFile.size > 0 ? await prepareIcon(iconFile) : null;

  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({ data: { name: input.name }, select: { id: true } });
    const user = await createUserWithPassword(tx, {
      companyId: created.id,
      name: input.adminName,
      email: input.adminEmail,
      role: "ADMIN",
      password: input.password,
    });
    await writePlatformLog(tx, actor, {
      action: "added company",
      targetType: "Company",
      target: input.name,
      change: `admin ${user.email}`,
    });
    return created;
  });

  if (icon) {
    await prisma.company.update({ where: { id: company.id }, data: await storeIcon(company.id, icon) });
  }

  return input.name;
}

export async function updateCompany(company: Company, changes: CompanyChanges, log: LogWriter): Promise<boolean> {
  const newName = companyName.parse(changes.name);
  const hasNewIcon = changes.icon !== null && changes.icon.size > 0;
  const removeIcon = !hasNewIcon && changes.removeIcon;
  const newSlackWebhookUrl =
    changes.slackWebhookUrl === undefined || changes.slackWebhookUrl.trim() === ""
      ? null
      : slackWebhookField.parse(changes.slackWebhookUrl);
  const { slackWebhookUrl } = await prisma.company.findUniqueOrThrow({ where: { id: company.id }, select: { slackWebhookUrl: true } });
  const renamed = newName !== company.name;
  const slackChanged = changes.slackWebhookUrl !== undefined && newSlackWebhookUrl !== slackWebhookUrl;

  if (!renamed && !slackChanged && !hasNewIcon && !removeIcon) return false;

  if (hasNewIcon) {
    await setCompanyIcon(company, changes.icon, log);
  } else if (removeIcon) {
    await removeCompanyIcon(company, log);
  }

  if (renamed || slackChanged) {
    await prisma.$transaction(async (tx) => {
      if (renamed) {
        await tx.company.update({ where: { id: company.id }, data: { name: newName } });
        await log(tx, { action: "renamed company", targetType: "Company", target: newName, change: `${company.name} → ${newName}` });
      }

      if (slackChanged) {
        await tx.company.update({ where: { id: company.id }, data: { slackWebhookUrl: newSlackWebhookUrl } });
        await log(tx, {
          action: newSlackWebhookUrl ? "changed Slack webhook" : "removed Slack webhook",
          targetType: "Company",
          target: newName,
        });
      }
    });
  }

  return true;
}

export async function deleteCompany(actor: SessionUser, companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      isPlatform: true,
      iconUrl: true,
      iconThumbUrl: true,
      projects: { select: { environments: { select: { id: true } } } },
    },
  });

  if (!company) throw new AuthError(403);
  if (company.isPlatform) throw new UserError("Our own company can't be deleted.");

  await prisma.$transaction(async (tx) => {
    await tx.flagEnvironment.deleteMany({ where: { flag: { project: { companyId: company.id } } } });
    await tx.company.delete({ where: { id: company.id } });
    await writePlatformLog(tx, actor, { action: "removed company", targetType: "Company", target: company.name });
  });

  await deleteIconFiles(company);
  await publishFlagChange(company.projects.flatMap((project) => project.environments.map((environment) => environment.id)));
}
