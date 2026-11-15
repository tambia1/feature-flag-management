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
import { createUserWithPassword } from "@/lib/users";

const name = (label: string) => z.string().trim().min(1, `Enter ${label}`).max(100);
const email = z.email("Enter a valid email").max(200);
const password = z.string().min(4, "Password: at least 4 characters").max(128);

async function assertEmailFree(value: string) {
  if (await prisma.user.findUnique({ where: { email: value.toLowerCase() }, select: { id: true } })) {
    throw new UserError("A user with this email already exists.");
  }
}

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
      await tx.flagEnvironment.deleteMany({ where: { flag: { project: { companyId: company.id } } } });
      await tx.company.delete({ where: { id: company.id } });
      await writePlatformLog(tx, admin, { action: "removed company", targetType: "Company", target: company.name });
    });

    await publishFlagChange(company.projects.flatMap((project) => project.environments.map((environment) => environment.id)));
    refresh();
  });
}
