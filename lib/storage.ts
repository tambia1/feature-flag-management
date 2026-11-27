import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import type { FileUpload } from "@/app/types";

const URL_PREFIX = "/api/uploads/";
const UPLOAD_EXPIRES_SECONDS = 5 * 60;

const createClient = (endpoint: string | undefined) => new S3Client({ endpoint, forcePathStyle: Boolean(endpoint) });

const s3 = createClient(process.env.S3_ENDPOINT);
const browserS3 = process.env.S3_PUBLIC_ENDPOINT ? createClient(process.env.S3_PUBLIC_ENDPOINT) : s3;

function bucket(): string {
  const name = process.env.S3_BUCKET;
  if (!name) throw new Error("S3_BUCKET is not set");
  return name;
}

const isMissing = (error: unknown) => error instanceof NoSuchKey || error instanceof NotFound;

export async function putFile(key: string, body: Buffer, contentType: string): Promise<string> {
  await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
  return URL_PREFIX + key;
}

export async function getFile(key: string): Promise<Buffer | null> {
  try {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    return object.Body ? Buffer.from(await object.Body.transformToByteArray()) : null;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function deleteFileByUrl(url: string | null): Promise<void> {
  if (!url?.startsWith(URL_PREFIX)) return;
  await deleteFile(url.slice(URL_PREFIX.length));
}

export async function createImageUpload(key: string, maxBytes: number): Promise<FileUpload> {
  const { url, fields } = await createPresignedPost(browserS3, {
    Bucket: bucket(),
    Key: key,
    Conditions: [
      ["content-length-range", 1, maxBytes],
      ["starts-with", "$Content-Type", "image/"],
    ],
    Expires: UPLOAD_EXPIRES_SECONDS,
  });

  return { key, url, fields };
}
