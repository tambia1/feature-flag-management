import type { FileUpload } from "@/app/types";
import { uploadFile } from "@/app/lib/apiClient";
import { MAX_ICON_BYTES } from "@/lib/uploads";

export async function uploadIconField(formData: FormData, startUpload: () => Promise<FileUpload>): Promise<string | null> {
  const file = formData.get("icon");
  formData.delete("icon");

  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_ICON_BYTES) return "The image must be 20 MB or smaller";
  if (!file.type.startsWith("image/")) return "Choose an image: PNG, JPEG, WebP or GIF.";

  try {
    const upload = await startUpload();
    await uploadFile(upload, file);
    formData.set("iconKey", upload.key);
    return null;
  } catch {
    return "The upload didn't finish. Try again.";
  }
}
