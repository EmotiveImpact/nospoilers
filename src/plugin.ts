import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { scan, type ScanReport } from "./scanner/index.ts";

const MAX_UPLOAD = 80 * 1024 * 1024;

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > limit) {
        reject(new Error("Upload is larger than 80 MB."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function isInsideCwd(candidate: string): boolean {
  const cwd = path.resolve(process.cwd());
  const resolved = path.resolve(candidate);
  return resolved === cwd || resolved.startsWith(`${cwd}${path.sep}`);
}

async function handleScan(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const contentType = req.headers["content-type"] ?? "";
    let report: ScanReport;

    if (contentType.includes("application/json")) {
      const raw = await readBody(req, 64_000);
      const payload = JSON.parse(raw.toString("utf8")) as { path?: string };
      if (!payload.path || typeof payload.path !== "string") {
        sendJson(res, 400, { error: "Provide a path to a packed artifact." });
        return;
      }
      if (!isInsideCwd(payload.path)) {
        sendJson(res, 400, { error: "Path must be inside this project directory." });
        return;
      }
      report = await scan(payload.path);
    } else {
      const filenameHeader = req.headers["x-filename"];
      const filename =
        typeof filenameHeader === "string" && filenameHeader.length > 0
          ? path.basename(filenameHeader)
          : "upload.bin";
      const data = await readBody(req, MAX_UPLOAD);
      const dir = path.join(os.tmpdir(), "nospoilers-upload");
      await mkdir(dir, { recursive: true });
      const dest = path.join(dir, `${Date.now()}-${filename}`);
      await writeFile(dest, data);
      report = await scan(dest);
    }

    sendJson(res, 200, report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed.";
    sendJson(res, 400, { error: message });
  }
}

export function nospoilersApi(): Plugin {
  return {
    name: "nospoilers-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (req.method === "POST" && url === "/api/scan") {
          void handleScan(req, res);
          return;
        }
        if (req.method === "GET" && url === "/api/health") {
          sendJson(res, 200, { ok: true, name: "nospoilers" });
          return;
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (req.method === "POST" && url === "/api/scan") {
          void handleScan(req, res);
          return;
        }
        if (req.method === "GET" && url === "/api/health") {
          sendJson(res, 200, { ok: true, name: "nospoilers" });
          return;
        }
        next();
      });
    },
  };
}
