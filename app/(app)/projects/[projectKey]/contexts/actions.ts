"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/app/types";
import { runAction, text } from "@/lib/actions";
import { writeLog } from "@/lib/audit";
import { assertEnvironmentRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { assertUser, AuthError } from "@/lib/session";

export async function deleteContext(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const user = await assertUser();
    const context = await prisma.context.findFirst({
      where: { id: text(formData, "contextId"), environment: { project: { companyId: user.companyId } } },
      select: {
        id: true,
        key: true,
        application: true,
        environmentId: true,
        environment: { select: { key: true, project: { select: { key: true } } } },
      },
    });

    if (!context) {
      throw new AuthError(403);
    }

    await assertEnvironmentRole(user, context.environmentId, "EDITOR");

    await prisma.$transaction(async (tx) => {
      await tx.context.delete({ where: { id: context.id } });
      await writeLog(tx, user, {
        action: "deleted context",
        targetType: "Context",
        target: `${context.application || "Unnamed app"} · ${context.key}`,
      });
    });

    redirect(`/projects/${context.environment.project.key}/contexts?env=${context.environment.key}`);
  });
}
