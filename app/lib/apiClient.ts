import type { FileUpload } from "@/app/types";

export async function uploadFile(upload: FileUpload, file: File): Promise<void> {
  const body = new FormData();

  for (const [name, value] of Object.entries(upload.fields)) {
    body.append(name, value);
  }

  body.append("Content-Type", file.type);
  body.append("file", file);

  const response = await fetch(upload.url, { method: "POST", body });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
}
