import "server-only";
import { unstable_rethrow } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import type { FormState } from "@/app/types";
import { Prisma } from "@/app/generated/prisma/client";
import { logger } from "./logger";
import { UserError } from "./errors";
import { AuthError } from "./session";

function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$") && !/password/i.test(key)) {
      values[key] = value;
    }
  }

  return values;
}

export async function runAction(formData: FormData | null, body: () => Promise<FormState | void>): Promise<FormState> {
  const values = formData ? formValues(formData) : undefined;

  try {
    return (await body()) ?? {};
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof UserError || error instanceof AuthError) {
      return { error: error.message, values };
    }

    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message ?? "Please check the form.", values };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "That name or key is already used. Pick another one.", values };
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { error: "This is still in use, so it can't be removed.", values };
    }

    const errorId = crypto.randomUUID().slice(0, 8);
    logger.error({ err: error, errorId }, "Server action failed");
    Sentry.captureException(error, { tags: { errorId } });

    return { error: `Something went wrong. Please try again. (Error id: ${errorId})`, values };
  }
}

export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
