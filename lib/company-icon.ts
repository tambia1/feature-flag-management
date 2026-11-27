import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { FileUpload, IconJob, IconUpload } from "@/app/types";
import { UserError } from "./errors";
import { sendIconJob } from "./icon-queue";
import { logger } from "./logger";
import type { LogWriter } from "./logs";
import { prisma } from "./prisma";
import { createImageUpload, deleteFile, deleteFileByUrl, fileExists, getFile, putFile } from "./storage";
import { MAX_ICON_BYTES } from "./uploads";

type IconUrls = { iconUrl: string | null; iconThumbUrl: string | null };
type Company = { id: string; name: string };
type ResizedIcon = { large: Buffer; thumb: Buffer };

const UPLOAD_FOLDER = "uploads";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function resizeIcon(input: Buffer): Promise<ResizedIcon | null> {
  try {
    const image = sharp(input).rotate();
    const [large, thumb] = await Promise.all([
      image.clone().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
      image.clone().resize(64, 64, { fit: "cover" }).webp({ quality: 85 }).toBuffer(),
    ]);
    return { large, thumb };
  } catch {
    return null;
  }
}

export async function deleteIconFiles(icon: IconUrls) {
  try {
    await Promise.all([deleteFileByUrl(icon.iconUrl), deleteFileByUrl(icon.iconThumbUrl)]);
  } catch (error) {
    logger.warn({ err: error }, "Could not delete company icon files");
  }
}

export function startIconUpload(userId: string): Promise<FileUpload> {
  return createImageUpload(`${UPLOAD_FOLDER}/${userId}/${randomUUID()}`, MAX_ICON_BYTES);
}

export async function checkIconUpload({ key, uploadedBy }: IconUpload): Promise<void> {
  const [folder, userId, id, ...rest] = key.split("/");

  if (folder !== UPLOAD_FOLDER || userId !== uploadedBy || !UUID.test(id ?? "") || rest.length > 0) {
    throw new UserError("That upload isn't yours. Choose the image again.");
  }

  if (!(await fileExists(key))) {
    throw new UserError("The upload didn't finish. Choose the image again.");
  }
}

export async function queueIconJob(job: IconJob): Promise<void> {
  try {
    await sendIconJob(job);
  } catch (error) {
    await prisma.company.updateMany({
      where: { id: job.companyId, iconSourceKey: job.key },
      data: { iconStatus: "FAILED", iconSourceKey: null },
    });
    throw error;
  }
}

export async function setCompanyIcon(company: Company, upload: IconUpload, log: LogWriter) {
  await checkIconUpload(upload);

  await prisma.$transaction(async (tx) => {
    await tx.company.update({ where: { id: company.id }, data: { iconStatus: "PROCESSING", iconSourceKey: upload.key } });
    await log(tx, { action: "changed company icon", targetType: "Company", target: company.name });
  });

  await queueIconJob({ companyId: company.id, key: upload.key });
}

export async function removeCompanyIcon(company: Company, log: LogWriter) {
  const old = await prisma.$transaction(async (tx) => {
    const previous = await tx.company.findUniqueOrThrow({ where: { id: company.id }, select: { iconUrl: true, iconThumbUrl: true } });
    await tx.company.update({
      where: { id: company.id },
      data: { iconUrl: null, iconThumbUrl: null, iconStatus: null, iconSourceKey: null },
    });
    await log(tx, { action: "removed company icon", targetType: "Company", target: company.name });
    return previous;
  });

  await deleteIconFiles(old);
}

export async function processIconJob(job: IconJob): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: job.companyId },
    select: { iconSourceKey: true, iconUrl: true, iconThumbUrl: true },
  });

  if (company?.iconSourceKey !== job.key) {
    await deleteFile(job.key);
    return;
  }

  const original = await getFile(job.key);
  const icon = original && (await resizeIcon(original));

  if (!icon) {
    await prisma.company.updateMany({
      where: { id: job.companyId, iconSourceKey: job.key },
      data: { iconStatus: "FAILED", iconSourceKey: null },
    });
    await deleteFile(job.key);
    return;
  }

  const base = `companies/${job.companyId}/${randomUUID()}`;
  const [iconUrl, iconThumbUrl] = await Promise.all([
    putFile(`${base}-1024.webp`, icon.large, "image/webp"),
    putFile(`${base}-64.webp`, icon.thumb, "image/webp"),
  ]);
  const { count } = await prisma.company.updateMany({
    where: { id: job.companyId, iconSourceKey: job.key },
    data: { iconUrl, iconThumbUrl, iconStatus: "READY", iconSourceKey: null },
  });

  await deleteIconFiles(count > 0 ? company : { iconUrl, iconThumbUrl });
  await deleteFile(job.key);
}
