"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/app/types";
import { runAction, text } from "@/lib/actions";
import { deleteContext as remove, findContext } from "@/lib/flags/contexts";
import { assertEnvironmentRole } from "@/lib/permissions";
import { assertUser } from "@/lib/session";

export async function deleteContext(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const user = await assertUser();
    const context = await findContext(user.companyId, text(formData, "contextId"));
    await assertEnvironmentRole(user, context.environmentId, "EDITOR");

    await remove(user, context);

    redirect(`/projects/${context.environment.project.key}/contexts?env=${context.environment.key}`);
  });
}
