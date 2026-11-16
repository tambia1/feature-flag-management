"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/app/types";
import { runAction, text, UserError } from "@/lib/actions";
import { track } from "@/lib/analytics";
import { writePlatformLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { publishFlagChange } from "@/lib/pubsub";
import { deleteIconFiles, prepareIcon, removeCompanyIcon, setCompanyIcon, storeIcon } from "@/lib/company-icon";
import { addCompanyUser, editCompanyUser, removeCompanyUser } from "@/lib/company-users";
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

    const iconFile = formData.get("icon");
    const icon = iconFile instanceof File && iconFile.size > 0 ? await prepareIcon(iconFile) : null;

    const company = await prisma.$transaction(async (tx) => {
      const created = await tx.company.create({ data: { name: input.name }, select: { id: true } });
      const user = await createUserWithPassword(tx, {
        companyId: created.id,
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
      return created;
    });

    if (icon) {
      await prisma.company.update({ where: { id: company.id }, data: await storeIcon(company.id, icon) });
    }

    track(admin.id, "company created");
    refresh();
    return { success: `Added ${input.name}` };
  });
}

export async function updateCompany(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    const company = await findCompany(text(formData, "companyId"));
    const newName = name("a company name").parse(text(formData, "name"));
    const icon = formData.get("icon");
    const hasNewIcon = icon instanceof File && icon.size > 0;
    const removeIcon = !hasNewIcon && text(formData, "removeIcon") === "1";

    if (newName === company.name && !hasNewIcon && !removeIcon) return { success: "No changes" };

    if (hasNewIcon) {
      await setCompanyIcon(company.id, icon, (tx) =>
        writePlatformLog(tx, admin, { action: "changed company icon", targetType: "Company", target: company.name }),
      );
    } else if (removeIcon) {
      await removeCompanyIcon(company.id, (tx) =>
        writePlatformLog(tx, admin, { action: "removed company icon", targetType: "Company", target: company.name }),
      );
    }

    if (newName !== company.name) {
      await prisma.$transaction(async (tx) => {
        await tx.company.update({ where: { id: company.id }, data: { name: newName } });
        await writePlatformLog(tx, admin, {
          action: "renamed company",
          targetType: "Company",
          target: newName,
          change: `${company.name} → ${newName}`,
        });
      });
    }

    refresh();
    return { success: "Saved" };
  });
}

export async function deleteCompany(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    const company = await prisma.company.findUnique({
      where: { id: text(formData, "companyId") },
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
      await writePlatformLog(tx, admin, { action: "removed company", targetType: "Company", target: company.name });
    });

    await deleteIconFiles(company);
    await publishFlagChange(company.projects.flatMap((project) => project.environments.map((environment) => environment.id)));
    refresh();
  });
}

async function findCompany(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });
  if (!company) throw new AuthError(403);
  return company;
}

export async function createCompanyUser(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    const result = await addCompanyUser(admin, await findCompany(text(formData, "companyId")), formData);
    refresh();
    return result;
  });
}

export async function updateCompanyUser(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    const result = await editCompanyUser(admin, await findCompany(text(formData, "companyId")), formData);
    refresh();
    return result;
  });
}

export async function deleteCompanyUser(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    await removeCompanyUser(admin, await findCompany(text(formData, "companyId")), formData);
    refresh();
  });
}
