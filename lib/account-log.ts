import "server-only";
import { logger } from "./logger";
import { writeLog } from "./logs";
import { prisma } from "./prisma";
import { findSessionUser } from "./users";

export type AccountAction = "signed in" | "signed out" | "changed password";

export type Device = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\//, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

export function describeDevice({ ipAddress, userAgent }: Device): string {
  const agent = userAgent ?? "";
  const browser = BROWSERS.find(([pattern]) => pattern.test(agent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(agent))?.[1];
  const device = browser && system ? `${browser} on ${system}` : (browser ?? system ?? (agent ? "Other browser" : null));

  const knownIp = ipAddress && !/^[0:.]+$/.test(ipAddress) ? ipAddress : null;

  return [knownIp ?? "Unknown IP", device].filter(Boolean).join(" · ");
}

export async function logAccountEvent(userId: string, action: AccountAction, device: Device): Promise<void> {
  try {
    const user = await findSessionUser(userId);

    if (!user) {
      return;
    }

    await prisma.$transaction((tx) =>
      writeLog(tx, user, { action, targetType: "User", target: user.email, change: describeDevice(device) }),
    );
  } catch (err) {
    logger.warn({ err, action }, "Could not write account log");
  }
}

export function logFailedSignIn(device: Device): void {
  logger.warn({ ipAddress: device.ipAddress, device: describeDevice(device) }, "Failed sign-in");
}
