import "server-only";
import sharp from "sharp";
import { UserError } from "./actions";
import { logger } from "./logger";
import type { Tx } from "./prisma";
import { prisma } from "./prisma";
import { deleteFileByUrl, putFile } from "./storage";
import { MAX_ICON_BYTES } from "./uploads";

type IconUrls = { iconUrl: string | null; iconThumbUrl: string | null };
type WriteLog = (tx: Tx) => Promise<void>;

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

async function replaceIcon(companyId: string, icon: IconUrls, writeLog: WriteLog) {
  const old = await prisma.$transaction(async (tx) => {
    const previous = await tx.company.findUniqueOrThrow({ where: { id: companyId }, select: { iconUrl: true, iconThumbUrl: true } });
    await tx.company.update({ where: { id: companyId }, data: icon });
    await writeLog(tx);
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

export async function setCompanyIcon(companyId: string, file: File, writeLog: WriteLog) {
  const icon = await prepareIcon(file);
  await replaceIcon(companyId, await storeIcon(companyId, icon), writeLog);
}

export async function removeCompanyIcon(companyId: string, writeLog: WriteLog) {
  await replaceIcon(companyId, { iconUrl: null, iconThumbUrl: null }, writeLog);
}

export function iconFile(formData: FormData): File {
  const file = formData.get("icon");
  if (!(file instanceof File)) throw new UserError("Choose an image to upload");
  return file;
}
