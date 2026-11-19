"use server";

import { headers } from "next/headers";
import { z } from "zod";
import type { FormState } from "@/app/types";
import { runAction } from "@/lib/actions";
import { UserError } from "@/lib/errors";
import { auth } from "@/lib/auth";
import { assertUser } from "@/lib/session";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(4, "New password: at least 4 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((input) => input.newPassword === input.confirmPassword, "The new passwords don't match");

export async function changePassword(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    await assertUser();
    const input = schema.parse(Object.fromEntries(formData));

    try {
      await auth.api.changePassword({
        body: { currentPassword: input.currentPassword, newPassword: input.newPassword, revokeOtherSessions: true },
        headers: await headers(),
      });
    } catch {
      throw new UserError("Wrong current password");
    }

    return { success: "Password changed. You were logged out on other devices." };
  });
}
