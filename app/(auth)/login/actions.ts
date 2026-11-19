"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/app/types";
import { runAction, text } from "@/lib/actions";
import { UserError } from "@/lib/errors";
import { auth } from "@/lib/auth";
import { track } from "@/lib/analytics";

const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, async () => {
    const { email, password } = schema.parse({ email: text(formData, "email"), password: formData.get("password") });

    let userId: string;

    try {
      const result = await auth.api.signInEmail({ body: { email: email.toLowerCase(), password }, headers: await headers() });
      userId = result.user.id;
    } catch {
      throw new UserError("Wrong email or password");
    }

    track(userId, "login");
    redirect("/");
  });
}
