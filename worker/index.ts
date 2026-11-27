import { processIconJob } from "@/lib/company-icon";
import { finishIconJob, receiveIconJobs } from "@/lib/icon-queue";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const RETRY_AFTER_ERROR_MS = 5_000;

const stopping = new AbortController();

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    logger.info({ signal }, "Icon worker stopping");
    stopping.abort();
  });
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  logger.info("Icon worker started");

  while (!stopping.signal.aborted) {
    let jobs: Awaited<ReturnType<typeof receiveIconJobs>> = [];

    try {
      jobs = await receiveIconJobs(stopping.signal);
    } catch (err) {
      if (stopping.signal.aborted) break;
      logger.error({ err }, "Could not read the icon queue");
      await pause(RETRY_AFTER_ERROR_MS);
      continue;
    }

    for (const { job, receipt } of jobs) {
      const startedAt = Date.now();

      try {
        await processIconJob(job);
        await finishIconJob(receipt);
        logger.info({ companyId: job.companyId, ms: Date.now() - startedAt }, "Icon job done");
      } catch (err) {
        logger.error({ err, companyId: job.companyId }, "Icon job failed, the queue will retry it");
      }
    }
  }

  await prisma.$disconnect();
  logger.info("Icon worker stopped");
}

await run();
