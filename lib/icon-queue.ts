import "server-only";
import { DeleteMessageCommand, GetQueueAttributesCommand, ReceiveMessageCommand, SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { z } from "zod";
import type { IconJob } from "@/app/types";
import { logger } from "./logger";

const WAIT_SECONDS = 20;
const BATCH_SIZE = 5;

const sqs = new SQSClient({ endpoint: process.env.SQS_ENDPOINT });

const jobSchema = z.object({ companyId: z.string().min(1), key: z.string().min(1) });

type ReceivedJob = { job: IconJob; receipt: string };

type QueueDepth = { waiting: number; inFlight: number };

const readJson = (text: string | undefined): unknown => {
  try {
    return JSON.parse(text ?? "");
  } catch {
    return null;
  }
};

function queueUrl(): string {
  const url = process.env.ICON_QUEUE_URL;
  if (!url) throw new Error("ICON_QUEUE_URL is not set");
  return url;
}

export async function sendIconJob(job: IconJob): Promise<void> {
  await sqs.send(new SendMessageCommand({ QueueUrl: queueUrl(), MessageBody: JSON.stringify(job) }));
}

export async function finishIconJob(receipt: string): Promise<void> {
  await sqs.send(new DeleteMessageCommand({ QueueUrl: queueUrl(), ReceiptHandle: receipt }));
}

export async function receiveIconJobs(abortSignal?: AbortSignal): Promise<ReceivedJob[]> {
  const { Messages = [] } = await sqs.send(
    new ReceiveMessageCommand({ QueueUrl: queueUrl(), MaxNumberOfMessages: BATCH_SIZE, WaitTimeSeconds: WAIT_SECONDS }),
    { abortSignal },
  );
  const jobs: ReceivedJob[] = [];

  for (const message of Messages) {
    if (!message.ReceiptHandle) continue;
    const parsed = jobSchema.safeParse(readJson(message.Body));

    if (parsed.success) {
      jobs.push({ job: parsed.data, receipt: message.ReceiptHandle });
    } else {
      logger.error({ body: message.Body }, "Dropping an icon job that isn't valid");
      await finishIconJob(message.ReceiptHandle);
    }
  }

  return jobs;
}

export async function iconQueueDepth(): Promise<QueueDepth> {
  const { Attributes = {} } = await sqs.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl(),
      AttributeNames: ["ApproximateNumberOfMessages", "ApproximateNumberOfMessagesNotVisible"],
    }),
  );

  return {
    waiting: Number(Attributes.ApproximateNumberOfMessages ?? 0),
    inFlight: Number(Attributes.ApproximateNumberOfMessagesNotVisible ?? 0),
  };
}
