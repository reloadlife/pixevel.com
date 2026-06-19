import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function resolveStaticFile(segments: string[]) {
  const root = path.resolve(process.cwd(), "statics");
  const filePath = path.resolve(/*turbopackIgnore: true*/ root, ...segments);

  if (filePath !== root && filePath.startsWith(`${root}${path.sep}`)) {
    return filePath;
  }

  return null;
}

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params;
  const filePath = resolveStaticFile(segments);

  if (!filePath) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      return new Response("Not found", { status: 404 });
    }

    const file = await readFile(filePath);
    const contentType =
      CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";

    return new Response(new Uint8Array(file), {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(file.length),
        "Content-Type": contentType,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
