import "server-only";
import type { IconUpload } from "@/app/types";
import { text } from "@/lib/actions";
import { UserError } from "@/lib/errors";

export function readIconUpload(formData: FormData, uploadedBy: string): IconUpload | null {
  const key = text(formData, "iconKey");
  return key ? { key, uploadedBy } : null;
}

export function requireIconUpload(formData: FormData, uploadedBy: string): IconUpload {
  const upload = readIconUpload(formData, uploadedBy);
  if (!upload) throw new UserError("Choose an image to upload");
  return upload;
}
