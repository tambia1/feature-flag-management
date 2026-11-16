import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }

  const spec = await readFile(path.join(process.cwd(), "app/api/docs/openapi.yaml"), "utf8");

  return new Response(spec, {
    headers: { "Content-Type": "application/yaml; charset=utf-8" },
  });
}
