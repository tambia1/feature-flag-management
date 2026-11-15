"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/types";
import { runAction, text, UserError } from "@/lib/actions";
import { track } from "@/lib/analytics";
import { writePlatformLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { publishFlagChange } from "@/lib/pubsub";
import { assertPlatformAdmin, AuthError } from "@/lib/session";
import { createUserWithPassword, setUserPassword } from "@/lib/users";

const name = (label: string) => z.string().trim().min(1, `Enter ${label}`).max(100);
const email = z.email("Enter a valid email").max(200);
const password = z.string().min(8, "Password: at least 8 characters").max(128);

async function assertEmailFree(value: string) {
  if (await prisma.user.findUnique({ where: { email: value.toLowerCase() }, select: { id: true } })) {
    throw new UserError("A user with this email already exists.");
  }
}

// ---------- Companies ----------

/** Creates the company and its first admin. */
export async function createCompany(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    const input = z.object({ name: name("a company name"), adminName: name("the admin's name"), adminEmail: email, password }).parse({
      name: text(formData, "name"),
      adminName: text(formData, "adminName"),
      adminEmail: text(formData, "adminEmail"),
      password: formData.get("password"),
    });

    await assertEmailFree(input.adminEmail);

    await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({ data: { name: input.name } });
      const user = await createUserWithPassword(tx, {
        companyId: company.id,
        name: input.adminName,
        email: input.adminEmail,
        role: "ADMIN",
        password: input.password,
      });
      await writePlatformLog(tx, admin, {
        action: "added company",
        targetType: "Company",
        target: input.name,
        change: `admin ${user.email}`,
      });
    });

    track(admin.id, "company created");
    refresh();
    return { success: `Added ${input.name}` };
  });
}

export async function renameCompany(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    const company = await prisma.company.findUnique({ where: { id: text(formData, "companyId") }, select: { id: true, name: true } });

    if (!company) throw new AuthError(403);

    const newName = name("a company name").parse(text(formData, "name"));
    if (newName === company.name) return { success: "No changes" };

    await prisma.$transaction(async (tx) => {
      await tx.company.update({ where: { id: company.id }, data: { name: newName } });
      await writePlatformLog(tx, admin, {
        action: "renamed company",
        targetType: "Company",
        target: newName,
        change: `${company.name} → ${newName}`,
      });
    });

    refresh();
    return { success: "Saved" };
  });
}

/** Deletes a company and everything under it. Our own (platform) company can't be deleted. */
export async function deleteCompany(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    const company = await prisma.company.findUnique({
      where: { id: text(formData, "companyId") },
      select: { id: true, name: true, isPlatform: true, projects: { select: { environments: { select: { id: true } } } } },
    });

    if (!company) throw new AuthError(403);
    if (company.isPlatform) throw new UserError("Our own company can't be deleted.");

    await prisma.$transaction(async (tx) => {
      // FlagEnvironment first: its off value points to a variation (RESTRICT).
      await tx.flagEnvironment.deleteMany({ where: { flag: { project: { companyId: company.id } } } });
      await tx.company.delete({ where: { id: company.id } });
      await writePlatformLog(tx, admin, { action: "removed company", targetType: "Company", target: company.name });
    });

    await publishFlagChange(company.projects.flatMap((project) => project.environments.map((environment) => environment.id)));
    refresh();
  });
}

// ---------- Platform admins (= ADMIN users of the platform company) ----------

async function platformCompanyId(): Promise<string> {
  return (await prisma.company.findFirstOrThrow({ where: { isPlatform: true }, select: { id: true } })).id;
}

async function findPlatformAdmin(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, role: "ADMIN", company: { isPlatform: true } },
    select: { id: true, name: true, email: true, companyId: true },
  });

  if (!user) throw new AuthError(403);
  return user;
}

export async function addPlatformAdmin(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    const input = z
      .object({ name: name("a name"), email, password })
      .parse({ name: text(formData, "name"), email: text(formData, "email"), password: formData.get("password") });

    await assertEmailFree(input.email);
    const companyId = await platformCompanyId();

    await prisma.$transaction(async (tx) => {
      const user = await createUserWithPassword(tx, { companyId, ...input, role: "ADMIN" });
      await writePlatformLog(tx, admin, { action: "added platform admin", targetType: "PlatformAdmin", target: user.email });
    });

    refresh();
    return { success: `Added ${input.name}` };
  });
}

export async function updatePlatformAdmin(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    const user = await findPlatformAdmin(text(formData, "userId"));
    const input = z.object({ name: name("a name"), email }).parse({ name: text(formData, "name"), email: text(formData, "email") });
    const rawPassword = String(formData.get("password") ?? "");
    const newPassword = rawPassword ? password.parse(rawPassword) : null;

    const changes: string[] = [];
    if (input.name !== user.name) changes.push(`name: ${user.name} → ${input.name}`);
    if (input.email.toLowerCase() !== user.email) changes.push(`email: ${user.email} → ${input.email.toLowerCase()}`);
    if (newPassword) changes.push("new password");

    if (changes.length === 0) return { success: "No changes" };

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { name: input.name, email: input.email.toLowerCase() } });
      if (newPassword) await setUserPassword(tx, user.id, newPassword);
      await writePlatformLog(tx, admin, {
        action: "edited platform admin",
        targetType: "PlatformAdmin",
        target: input.email.toLowerCase(),
        change: changes.join(" · "),
      });
    });

    refresh();
    return { success: "Saved" };
  });
}

export async function removePlatformAdmin(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    const user = await findPlatformAdmin(text(formData, "userId"));

    if (user.id === admin.id) {
      throw new UserError("You can't remove yourself. Ask another platform admin.");
    }

    await prisma.$transaction(async (tx) => {
      const others = await tx.user.count({ where: { companyId: user.companyId, role: "ADMIN", id: { not: user.id } } });
      if (others === 0) throw new UserError("The last platform admin can't be removed.");

      await tx.user.delete({ where: { id: user.id } });
      await writePlatformLog(tx, admin, { action: "removed platform admin", targetType: "PlatformAdmin", target: user.email });
    });

    refresh();
  });
}
