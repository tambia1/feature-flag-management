import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // No public sign-up: company admins create users.
    disableSignUp: true,
    minPasswordLength: 4,
  },
  session: {
    // No cookie cache: deleting a user or session logs them out on the next request.
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      companyId: { type: "string", required: true, input: false },
      role: { type: "string", required: false, defaultValue: "MEMBER", input: false },
    },
  },
  advanced: {
    database: { generateId: false },
  },
  plugins: [nextCookies()],
});
