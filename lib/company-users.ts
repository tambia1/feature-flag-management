import "server-only";
import { z } from "zod";
import type { FormState, SessionUser } from "@/app/types";
import { UserError } from "@/lib/errors";
import { type LogEntry, writeLog, writePlatformLog } from "@/lib/logs";
import { prisma, type Tx } from "@/lib/prisma";
import { AuthError } from "@/lib/session";
import { createUserWithPassword, setUserPassword } from "@/lib/users";

type Company = { id: string; name: string };

const password = z.string().min(4, "Password: at least 4 characters").max(128);
const userSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(100),
  email: z.email("Enter a valid email").max(200),
  role: z.enum(["ADMIN", "MEMBER"]),
});

export type UserInput = { name: string; email: string; role: string; password: string };

export async function findUser(companyId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, companyId }, select: { id: true, name: true, email: true, role: true } });
  if (!user) throw new AuthError(403);
  return user;
}

async function assertNotLastAdmin(tx: Tx, companyId: string, userId: string) {
  const otherAdmins = await tx.user.count({ where: { companyId, role: "ADMIN", id: { not: userId } } });

  if (otherAdmins === 0) {
    throw new UserError("The last admin can't be removed or demoted.");
  }
}

async function log(tx: Tx, actor: SessionUser, company: Company, entry: LogEntry) {
  await writeLog(tx, actor, entry, company.id, company.name);

  if (actor.companyId !== company.id) {
    await writePlatformLog(tx, actor, { ...entry, target: `${entry.target} (${company.name})` });
  }
}

export async function addCompanyUser(actor: SessionUser, company: Company, newUser: UserInput): Promise<FormState> {
  const input = userSchema.parse(newUser);
  const newPassword = password.parse(newUser.password);

  if (await prisma.user.findUnique({ where: { email: input.email.toLowerCase() }, select: { id: true } })) {
    throw new UserError("A user with this email already exists.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const user = await createUserWithPassword(tx, { companyId: company.id, ...input, password: newPassword });
    await log(tx, actor, company, { action: "added user", targetType: "User", target: user.email, change: input.role.toLowerCase() });
    return user;
  });

  return { success: `Added ${created.name}` };
}

export async function editCompanyUser(actor: SessionUser, company: Company, userId: string, edited: UserInput): Promise<FormState> {
  const user = await findUser(company.id, userId);
  const input = userSchema.parse(edited);
  const newPassword = edited.password ? password.parse(edited.password) : null;

  const changes: string[] = [];
  if (input.name !== user.name) changes.push(`name: ${user.name} → ${input.name}`);
  if (input.email.toLowerCase() !== user.email) changes.push(`email: ${user.email} → ${input.email.toLowerCase()}`);
  if (input.role !== user.role) changes.push(`${user.role.toLowerCase()} → ${input.role.toLowerCase()}`);
  if (newPassword) changes.push("new password");

  if (changes.length === 0) {
    return { success: "No changes" };
  }

  await prisma.$transaction(async (tx) => {
    if (user.role === "ADMIN" && input.role !== "ADMIN") {
      await assertNotLastAdmin(tx, company.id, user.id);
    }

    await tx.user.update({ where: { id: user.id }, data: { name: input.name, email: input.email.toLowerCase(), role: input.role } });

    if (newPassword) {
      await setUserPassword(tx, user.id, newPassword);
    }

    await log(tx, actor, company, {
      action: input.role !== user.role ? "changed role" : "edited user",
      targetType: "User",
      target: input.email.toLowerCase(),
      change: changes.join(" · "),
    });
  });

  return { success: "Saved" };
}

export async function removeCompanyUser(actor: SessionUser, company: Company, userId: string): Promise<void> {
  const user = await findUser(company.id, userId);

  if (user.id === actor.id) {
    throw new UserError("You can't delete yourself. Ask another admin.");
  }

  await prisma.$transaction(async (tx) => {
    if (user.role === "ADMIN") {
      await assertNotLastAdmin(tx, company.id, user.id);
    }

    await tx.user.delete({ where: { id: user.id } });
    await log(tx, actor, company, { action: "removed user", targetType: "User", target: user.email });
  });
}
