import "server-only";
import { z } from "zod";
import { logger } from "./logger";
import { prisma } from "./prisma";

const WEBHOOK_PREFIX = "https://hooks.slack.com/services/";

export const slackWebhookField = z
  .string()
  .trim()
  .max(500)
  .refine((url) => url.startsWith(WEBHOOK_PREFIX), "Paste a Slack webhook URL that starts with https://hooks.slack.com/services/");

export async function notifySlack(companyId: string, text: string): Promise<void> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { slackWebhookUrl: true } });
  const url = company?.slackWebhookUrl;

  if (!url) {
    return;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status, companyId }, "slack notification failed");
    }
  } catch (error) {
    logger.warn({ err: error, companyId }, "slack notification failed");
  }
}
