import "server-only";
import { logger } from "./logger";

export async function notifySlack(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;

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
      logger.warn({ status: response.status }, "slack notification failed");
    }
  } catch (error) {
    logger.warn({ err: error }, "slack notification failed");
  }
}
