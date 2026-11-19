"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/app/types";
import { runAction, text } from "@/lib/actions";
import { track } from "@/lib/analytics";
import { UserError } from "@/lib/errors";
import {
  archiveFlag as archive,
  createFlag as create,
  deleteFlag as remove,
  findFlag,
  removeVariation as removeFlagVariation,
  restoreFlag as restore,
  saveTargeting as save,
  setFlagOn as setOn,
  updateFlagSettings as updateSettings,
} from "@/lib/flags/flags";
import { assertEnvironmentRole, assertProjectEditor } from "@/lib/permissions";
import { assertUser } from "@/lib/session";

const comment = (formData: FormData) => text(formData, "comment") || null;

async function editableFlag(formData: FormData) {
  const user = await assertUser();
  const flag = await findFlag(user.companyId, text(formData, "flagId"));
  await assertProjectEditor(user, flag.projectId);
  return { user, flag };
}

async function flagInEditableEnvironment(formData: FormData) {
  const user = await assertUser();
  const flag = await findFlag(user.companyId, text(formData, "flagId"));
  const environmentId = text(formData, "environmentId");
  await assertEnvironmentRole(user, environmentId, "EDITOR");
  return { user, flag, environmentId };
}

export async function createFlag(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const user = await assertUser();
    const projectId = text(formData, "projectId");
    await assertProjectEditor(user, projectId);

    const created = await create(user, projectId, {
      key: text(formData, "key"),
      name: text(formData, "name"),
      description: text(formData, "description"),
      type: text(formData, "type"),
      variations: formData.getAll("variation").map(String),
      onIndex: Number(text(formData, "onIndex")),
      offIndex: Number(text(formData, "offIndex")),
    });

    track(user.id, "flag created", { type: text(formData, "type") });
    redirect(`/projects/${created.projectKey}/flags/${created.flagKey}`);
  });
}

export async function setFlagOn(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const { user, flag, environmentId } = await flagInEditableEnvironment(formData);
    const isOn = text(formData, "isOn") === "true";

    await setOn(user, flag, environmentId, isOn, comment(formData));

    track(user.id, "flag toggled", { on: isOn });
    refresh();
  });
}

export async function saveTargeting(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const { user, flag, environmentId } = await flagInEditableEnvironment(formData);

    let targeting: unknown;
    try {
      targeting = JSON.parse(text(formData, "targeting"));
    } catch {
      throw new UserError("Please check the targeting settings.");
    }

    await save(user, flag, environmentId, targeting, comment(formData));

    refresh();
    return { success: "Saved" };
  });
}

export async function updateFlagSettings(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const { user, flag } = await editableFlag(formData);
    const field = (name: string) => {
      const value = formData.get(name);
      return typeof value === "string" ? value : null;
    };

    await updateSettings(user, flag, {
      name: text(formData, "name"),
      description: text(formData, "description"),
      variationValues: Object.fromEntries(flag.variations.map((variation) => [variation.id, field(`variation-${variation.id}`)])),
      newVariations: formData.getAll("newVariation").map(String),
    });

    refresh();
    return { success: "Saved" };
  });
}

export async function removeVariation(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const { user, flag } = await editableFlag(formData);
    await removeFlagVariation(user, flag, text(formData, "variationId"));
    refresh();
  });
}

export async function archiveFlag(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const { user, flag } = await editableFlag(formData);
    await archive(user, flag);
    track(user.id, "flag archived");
    redirect(`/projects/${flag.project.key}/archived`);
  });
}

export async function restoreFlag(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const { user, flag } = await editableFlag(formData);
    await restore(user, flag);
    refresh();
  });
}

export async function deleteFlag(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const { user, flag } = await editableFlag(formData);
    await remove(user, flag);
    track(user.id, "flag deleted");

    if (text(formData, "from") === "settings") {
      redirect(`/projects/${flag.project.key}/archived`);
    }

    refresh();
  });
}
