import "server-only";
import type { SessionUser } from "@/app/types";
import type { Tx } from "./prisma";

export type LogEntry = {
  action: string;
  targetType: "Flag" | "User" | "Team" | "Project" | "Environment" | "Company" | "PlatformAdmin";
  target: string;
  change?: string | null;
  comment?: string | null;
};

/**
 * Appends to the company log (never updated or deleted).
 * Pass the transaction so the log entry is saved together with the change — or not at all.
 */
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

/** Platform events are stored under our own (platform) company, so they survive when a company is deleted. */
export async function writePlatformLog(tx: Tx, user: SessionUser, entry: LogEntry) {
  const platform = await tx.company.findFirstOrThrow({ where: { isPlatform: true }, select: { id: true, name: true } });
  await writeLog(tx, user, entry, platform.id, platform.name);
}
