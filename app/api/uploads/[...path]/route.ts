import { getFile } from "@/lib/storage";

export async function GET(_request: Request, { params }: RouteContext<"/api/uploads/[...path]">) {
  const { path } = await params;
  const key = path.join("/");

  if (!key.endsWith(".webp")) {
    return new Response("Not found", { status: 404 });
  }

  const file = await getFile(key);

  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(file), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
