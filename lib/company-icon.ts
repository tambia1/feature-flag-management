import "server-only";
import sharp from "sharp";
import { UserError } from "./errors";
import { logger } from "./logger";
import type { LogWriter } from "./logs";
import { prisma } from "./prisma";
import { deleteFileByUrl, putFile } from "./storage";
import { MAX_ICON_BYTES } from "./uploads";

type IconUrls = { iconUrl: string | null; iconThumbUrl: string | null };
type Company = { id: string; name: string };

type PreparedIcon = { large: Buffer; thumb: Buffer };

async function resizeIcon(input: Buffer): Promise<PreparedIcon> {
  try {
    const image = sharp(input).rotate();
    const [large, thumb] = await Promise.all([
      image.clone().resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(),
      image.clone().resize(64, 64, { fit: "cover" }).webp({ quality: 85 }).toBuffer(),
    ]);
    return { large, thumb };
  } catch {
    throw new UserError("That file isn't an image we can read. Try a PNG, JPEG, WebP or GIF.");
  }
}

export async function deleteIconFiles(icon: IconUrls) {
  try {
    await Promise.all([deleteFileByUrl(icon.iconUrl), deleteFileByUrl(icon.iconThumbUrl)]);
  } catch (error) {
    logger.warn({ err: error }, "Could not delete company icon files");
  }
}

async function replaceIcon(company: Company, icon: IconUrls, action: string, log: LogWriter) {
  const old = await prisma.$transaction(async (tx) => {
    const previous = await tx.company.findUniqueOrThrow({ where: { id: company.id }, select: { iconUrl: true, iconThumbUrl: true } });
    await tx.company.update({ where: { id: company.id }, data: icon });
    await log(tx, { action, targetType: "Company", target: company.name });
    return previous;
  });

  await deleteIconFiles(old);
}

export async function prepareIcon(file: File): Promise<PreparedIcon> {
  if (file.size === 0) throw new UserError("Choose an image to upload");
  if (file.size > MAX_ICON_BYTES) throw new UserError("The image must be 20 MB or smaller");
  return resizeIcon(Buffer.from(await file.arrayBuffer()));
}

export async function storeIcon(companyId: string, icon: PreparedIcon) {
  const base = `companies/${companyId}/${crypto.randomUUID()}`;
  const [iconUrl, iconThumbUrl] = await Promise.all([putFile(`${base}-1024.webp`, icon.large), putFile(`${base}-64.webp`, icon.thumb)]);
  return { iconUrl, iconThumbUrl };
}

export async function setCompanyIcon(company: Company, file: File | null, log: LogWriter) {
  if (!file) throw new UserError("Choose an image to upload");
  const icon = await prepareIcon(file);
  await replaceIcon(company, await storeIcon(company.id, icon), "changed company icon", log);
}

export async function removeCompanyIcon(company: Company, log: LogWriter) {
  await replaceIcon(company, { iconUrl: null, iconThumbUrl: null }, "removed company icon", log);
}
