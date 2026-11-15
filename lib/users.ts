import { hashPassword } from "better-auth/crypto";
import type { Tx } from "./prisma";

type NewUser = {
  companyId: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  password: string;
};

export async function createUserWithPassword(tx: Tx, user: NewUser) {
  const created = await tx.user.create({
    data: {
      companyId: user.companyId,
      name: user.name,
      email: user.email.toLowerCase(),
      role: user.role,
      emailVerified: true,
    },
    select: { id: true, name: true, email: true },
  });

  await tx.account.create({
    data: {
      userId: created.id,
      accountId: created.id,
      providerId: "credential",
      password: await hashPassword(user.password),
    },
  });

  return created;
}

export async function setUserPassword(tx: Tx, userId: string, password: string) {
  await tx.account.updateMany({
    where: { userId, providerId: "credential" },
    data: { password: await hashPassword(password) },
  });
  await tx.session.deleteMany({ where: { userId } });
}
