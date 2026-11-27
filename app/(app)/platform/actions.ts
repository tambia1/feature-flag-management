"use server";

import { refresh } from "next/cache";
import type { FileUpload, FormState } from "@/app/types";
import { runAction, text } from "@/lib/actions";
import { track } from "@/lib/analytics";
import { createCompany as create, deleteCompany as remove, findCompany, updateCompany as update } from "@/lib/companies";
import { startIconUpload } from "@/lib/company-icon";
import { addCompanyUser, editCompanyUser, removeCompanyUser } from "@/lib/company-users";
import { platformLog } from "@/lib/logs";
import { assertPlatformAdmin } from "@/lib/session";
import { readIconUpload } from "../icon-form";
import { readUserForm } from "../user-form";

export async function startCompanyIconUpload(): Promise<FileUpload> {
  const admin = await assertPlatformAdmin();
  return startIconUpload(admin.id);
}

export async function createCompany(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    const name = await create(
      admin,
      {
        name: text(formData, "name"),
        adminName: text(formData, "adminName"),
        adminEmail: text(formData, "adminEmail"),
        password: String(formData.get("password") ?? ""),
      },
      readIconUpload(formData, admin.id),
    );
    track(admin.id, "company created");
    refresh();
    return { success: `Added ${name}` };
  });
}

export async function updateCompany(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    const company = await findCompany(text(formData, "companyId"));
    const changed = await update(
      company,
      { name: text(formData, "name"), icon: readIconUpload(formData, admin.id), removeIcon: text(formData, "removeIcon") === "1" },
      platformLog(admin),
    );
    refresh();
    return { success: changed ? "Saved" : "No changes" };
  });
}

export async function deleteCompany(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    await remove(admin, text(formData, "companyId"));
    refresh();
  });
}

export async function createCompanyUser(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    const result = await addCompanyUser(admin, await findCompany(text(formData, "companyId")), readUserForm(formData));
    refresh();
    return result;
  });
}

export async function updateCompanyUser(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    const company = await findCompany(text(formData, "companyId"));
    const result = await editCompanyUser(admin, company, text(formData, "userId"), readUserForm(formData));
    refresh();
    return result;
  });
}

export async function deleteCompanyUser(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertPlatformAdmin();
    await removeCompanyUser(admin, await findCompany(text(formData, "companyId")), text(formData, "userId"));
    refresh();
  });
}
