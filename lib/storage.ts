import "server-only";
import { mkdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.env.UPLOADS_DIR ?? ".uploads");
const URL_PREFIX = "/api/uploads/";

function resolveKey(key: string): string {
  const file = path.resolve(ROOT, key);

  if (!file.startsWith(ROOT + path.sep)) {
    throw new Error(`Invalid storage key: ${key}`);
  }

  return file;
}

export async function putFile(key: string, body: Buffer): Promise<string> {
  const file = resolveKey(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
  return URL_PREFIX + key;
}

export async function getFile(key: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveKey(key));
  } catch {
    return null;
  }
}

export async function deleteFileByUrl(url: string | null): Promise<void> {
  if (!url?.startsWith(URL_PREFIX)) return;
  const file = resolveKey(url.slice(URL_PREFIX.length));
  await rm(file, { force: true });
  await rmdir(path.dirname(file)).catch(() => {});
}
