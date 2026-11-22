import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware, getIP, getSessionFromCtx, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { logAccountEvent, logFailedSignIn } from "./account-log";
import { prisma } from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 4,
  },
  session: {
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
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-out") {
        return;
      }

      const session = await getSessionFromCtx(ctx).catch(() => null);

      if (session) {
        await logAccountEvent(session.user.id, "signed out", session.session);
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const failed = isAPIError(ctx.context.returned);

      if (ctx.path === "/sign-in/email") {
        const device = {
          ipAddress: ctx.headers ? getIP(ctx.headers, ctx.context.options) : null,
          userAgent: ctx.headers?.get("user-agent"),
        };

        if (failed) {
          logFailedSignIn(device);
        } else if (ctx.context.newSession) {
          await logAccountEvent(ctx.context.newSession.user.id, "signed in", ctx.context.newSession.session);
        }
      }

      if (ctx.path === "/change-password" && !failed && ctx.context.session) {
        await logAccountEvent(ctx.context.session.user.id, "changed password", ctx.context.session.session);
      }
    }),
  },
  plugins: [nextCookies()],
});
