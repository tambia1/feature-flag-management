import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionUser } from "@/app/types";
import { auth } from "./auth";
import { prisma } from "./prisma";

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      companyId: true,
      company: { select: { name: true, isPlatform: true, iconThumbUrl: true } },
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    companyName: user.company.name,
    companyIconUrl: user.company.iconThumbUrl,
    isPlatformAdmin: user.company.isPlatform && user.role === "ADMIN",
  };
});

export class AuthError extends Error {
  constructor(public status: 401 | 403) {
    super(status === 401 ? "Please log in again." : "You don't have permission to do this.");
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireCompanyAdmin(): Promise<SessionUser> {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    redirect("/");
  }

  return user;
}

export async function requirePlatformAdmin(): Promise<SessionUser> {
  const user = await requireUser();

  if (!user.isPlatformAdmin) {
    redirect("/");
  }

  return user;
}

export async function assertUser(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthError(401);
  }

  return user;
}

export async function assertCompanyAdmin(): Promise<SessionUser> {
  const user = await assertUser();

  if (user.role !== "ADMIN") {
    throw new AuthError(403);
  }

  return user;
}

export async function assertPlatformAdmin(): Promise<SessionUser> {
  const user = await assertUser();

  if (!user.isPlatformAdmin) {
    throw new AuthError(403);
  }

  return user;
}
