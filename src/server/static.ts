import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

export async function uiIndexExists(root: string): Promise<boolean> {
  try {
    const info = await stat(path.join(root, "index.html"));
    return info.isFile();
  } catch {
    return false;
  }
}

function safeFile(root: string, requestPath: string): string | null {
  const decoded = decodeURIComponent(requestPath.split("?")[0] ?? "");
  if (!decoded.startsWith("/") || decoded.includes("\0")) return null;
  const relative = decoded.replace(/^\/+/, "").replace(/\/+$/, "");
  if (relative === "") return path.join(root, "index.html");
  if (relative.split("/").some((part) => part === ".." || part === "")) return null;
  const resolved = path.resolve(root, relative);
  const rootAbs = path.resolve(root);
  if (resolved !== rootAbs && !resolved.startsWith(rootAbs + path.sep)) return null;
  return resolved;
}

async function fileResponse(file: string): Promise<Response | null> {
  try {
    const info = await stat(file);
    if (!info.isFile()) return null;
    const ext = path.extname(file).toLowerCase();
    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": TYPES[ext] ?? "application/octet-stream",
        "cache-control": ext === ".html" ? "no-store" : "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return null;
  }
}

export async function serveUi(
  requestPath: string,
  root: string,
): Promise<Response | null> {
  const file = safeFile(root, requestPath);
  if (!file) return null;
  const direct = await fileResponse(file);
  if (direct) return direct;
  return await fileResponse(path.join(path.resolve(root), "index.html"));
}
