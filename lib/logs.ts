import "server-only";
import type { SessionUser } from "@/app/types";
import type { Tx } from "./prisma";

export type LogEntry = {
  action: string;
  targetType: "Flag" | "User" | "Team" | "Project" | "Environment" | "Context" | "Company" | "PlatformAdmin";
  target: string;
  change?: string | null;
  comment?: string | null;
};

export async function writeLog(tx: Tx, user: SessionUser, entry: LogEntry, companyId = user.companyId, companyName = user.companyName) {
  await tx.log.create({
    data: {
      companyId,
      companyName,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: entry.action,
      targetType: entry.targetType,
      target: entry.target,
      change: entry.change ?? null,
      comment: entry.comment ?? null,
    },
  });
}

export async function writePlatformLog(tx: Tx, user: SessionUser, entry: LogEntry) {
  const platform = await tx.company.findFirstOrThrow({ where: { isPlatform: true }, select: { id: true, name: true } });
  await writeLog(tx, user, entry, platform.id, platform.name);
}

export type LogWriter = (tx: Tx, entry: LogEntry) => Promise<void>;

export const companyLog =
  (user: SessionUser): LogWriter =>
  (tx, entry) =>
    writeLog(tx, user, entry);

export const platformLog =
  (user: SessionUser): LogWriter =>
  (tx, entry) =>
    writePlatformLog(tx, user, entry);
