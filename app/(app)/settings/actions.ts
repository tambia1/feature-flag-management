"use server";

import { refresh } from "next/cache";
import type { FormState, SessionUser } from "@/app/types";
import { runAction, text } from "@/lib/actions";
import { track } from "@/lib/analytics";
import { updateCompany as updateCompanyDetails } from "@/lib/companies";
import { removeCompanyIcon, setCompanyIcon } from "@/lib/company-icon";
import { addCompanyUser, editCompanyUser, findUser, removeCompanyUser } from "@/lib/company-users";
import { companyLog } from "@/lib/logs";
import {
  addEnvironment as addProjectEnvironment,
  createProject as create,
  deleteEnvironment as removeEnvironment,
  deleteProject as removeProject,
  findEnvironment,
  findProject,
  renameEnvironment as renameProjectEnvironment,
  renameProject as rename,
  rotateSdkKey as rotateKey,
} from "@/lib/projects";
import { assertCompanyAdmin } from "@/lib/session";
import {
  addTeamMember as addMember,
  createTeam as createCompanyTeam,
  deleteTeam as removeTeam,
  findTeam,
  removeTeamMember as removeMember,
  renameTeam as renameCompanyTeam,
  saveTeamRoles,
} from "@/lib/teams";
import { readUserForm } from "../user-form";

const ownCompany = (admin: SessionUser) => ({ id: admin.companyId, name: admin.companyName });

const savedOrNoChanges = (changed: boolean): FormState => ({ success: changed ? "Saved" : "No changes" });

const iconFile = (formData: FormData) => {
  const file = formData.get("icon");
  return file instanceof File ? file : null;
};

const rolesFrom = (formData: FormData) =>
  Object.fromEntries(
    [...formData.entries()]
      .filter(([name, value]) => name.startsWith("role-") && typeof value === "string")
      .map(([name, value]) => [name.slice("role-".length), String(value).trim()]),
  );

export async function updateCompany(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const changed = await updateCompanyDetails(
      ownCompany(admin),
      { name: text(formData, "name"), icon: null, removeIcon: false, slackWebhookUrl: text(formData, "slackWebhookUrl") },
      companyLog(admin),
    );
    refresh();
    return savedOrNoChanges(changed);
  });
}

export async function updateCompanyIcon(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    await setCompanyIcon(ownCompany(admin), iconFile(formData), companyLog(admin));
    refresh();
    return { success: "Icon updated" };
  });
}

export async function deleteCompanyIcon(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    await removeCompanyIcon(ownCompany(admin), companyLog(admin));
    refresh();
    return { success: "Icon removed" };
  });
}

export async function createUser(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const result = await addCompanyUser(admin, ownCompany(admin), readUserForm(formData));
    track(admin.id, "user invited");
    refresh();
    return result;
  });
}

export async function updateUser(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const result = await editCompanyUser(admin, ownCompany(admin), text(formData, "userId"), readUserForm(formData));
    refresh();
    return result;
  });
}

export async function deleteUser(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    await removeCompanyUser(admin, ownCompany(admin), text(formData, "userId"));
    refresh();
  });
}

export async function createTeam(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const name = await createCompanyTeam(admin, text(formData, "name"));
    refresh();
    return { success: `Added ${name}` };
  });
}

export async function renameTeam(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const team = await findTeam(admin.companyId, text(formData, "teamId"));
    const changed = await renameCompanyTeam(admin, team, text(formData, "name"));
    refresh();
    return savedOrNoChanges(changed);
  });
}

export async function deleteTeam(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    await removeTeam(admin, await findTeam(admin.companyId, text(formData, "teamId")));
    refresh();
  });
}

export async function addTeamMember(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const team = await findTeam(admin.companyId, text(formData, "teamId"));
    await addMember(admin, team, await findUser(admin.companyId, text(formData, "userId")));
    refresh();
  });
}

export async function removeTeamMember(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const team = await findTeam(admin.companyId, text(formData, "teamId"));
    await removeMember(admin, team, await findUser(admin.companyId, text(formData, "userId")));
    refresh();
  });
}

export async function saveTeamPermissions(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const team = await findTeam(admin.companyId, text(formData, "teamId"));
    const changed = await saveTeamRoles(admin, team, rolesFrom(formData));
    refresh();
    return savedOrNoChanges(changed > 0);
  });
}

export async function createProject(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const name = await create(admin, { name: text(formData, "name"), key: text(formData, "key") });
    track(admin.id, "project created");
    refresh();
    return { success: `Added ${name}` };
  });
}

export async function renameProject(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const project = await findProject(admin.companyId, text(formData, "projectId"));
    const changed = await rename(admin, project, text(formData, "name"));
    refresh();
    return savedOrNoChanges(changed);
  });
}

export async function deleteProject(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    await removeProject(admin, await findProject(admin.companyId, text(formData, "projectId")));
    refresh();
  });
}

export async function addEnvironment(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const project = await findProject(admin.companyId, text(formData, "projectId"));
    const name = await addProjectEnvironment(admin, project, { name: text(formData, "name"), key: text(formData, "key") });
    refresh();
    return { success: `Added ${name}` };
  });
}

export async function renameEnvironment(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    const environment = await findEnvironment(admin.companyId, text(formData, "environmentId"));
    const changed = await renameProjectEnvironment(admin, environment, text(formData, "name"));
    refresh();
    return savedOrNoChanges(changed);
  });
}

export async function rotateSdkKey(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    await rotateKey(admin, await findEnvironment(admin.companyId, text(formData, "environmentId")));
    refresh();
  });
}

export async function deleteEnvironment(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const admin = await assertCompanyAdmin();
    await removeEnvironment(admin, await findEnvironment(admin.companyId, text(formData, "environmentId")));
    refresh();
  });
}
