import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  ENCRYPTION_INCONCLUSIVE,
  SERVERLESS_NOTE,
  packFormatFromName,
  sniffPackFormat,
  sniffServerlessLayout,
} from "../src/scanner/formats.ts";
import { scan } from "../src/scanner/index.ts";
import { isPackAssetName } from "../src/server/paths.ts";

const MAP = JSON.stringify({
  version: 3,
  sources: ["src/app.ts"],
  sourcesContent: ["export const secret = 1\n"],
  mappings: "AAAA",
});
const JS = "export const secret=1\n//# sourceMappingURL=index.js.map\n";
const HOST = JSON.stringify({ version: "2.0" });

async function writeZip(dest: string, files: Record<string, string | Buffer>): Promise<void> {
  const zip = new JSZip();
  for (const [name, contents] of Object.entries(files)) {
    zip.file(name, contents);
  }
  await writeFile(dest, await zip.generateAsync({ type: "nodebuffer" }));
}

function encryptedZipStub(): Buffer {
  const name = Buffer.from("x");
  const buf = Buffer.alloc(30 + name.length);
  buf.writeUInt32LE(0x04034b50, 0);
  buf.writeUInt16LE(20, 4);
  buf.writeUInt16LE(1, 6);
  buf.writeUInt16LE(0, 8);
  buf.writeUInt16LE(0, 10);
  buf.writeUInt16LE(0, 12);
  buf.writeUInt32LE(0, 14);
  buf.writeUInt32LE(0, 18);
  buf.writeUInt32LE(0, 22);
  buf.writeUInt16LE(name.length, 26);
  buf.writeUInt16LE(0, 28);
  name.copy(buf, 30);
  return buf;
}

describe("serverless layout sniff", () => {
  it("classifies Lambda/Azure/Netlify/Vercel layouts from entry names, not the extension", () => {
    expect(sniffServerlessLayout(["index.js", "package.json"])).toBe(false);
    expect(sniffServerlessLayout(["host.json", "index.js"])).toBe(true);
    expect(sniffServerlessLayout(["serverless.yml", "handler.js"])).toBe(true);
    expect(sniffServerlessLayout(["samconfig.toml"])).toBe(true);
    expect(sniffServerlessLayout(["HttpFn/function.json"])).toBe(true);
    expect(sniffServerlessLayout([".aws-sam/build/template.yaml"])).toBe(true);
    expect(sniffServerlessLayout([".vercel/output/config.json"])).toBe(true);
    expect(sniffServerlessLayout(["netlify/functions/hello.js"])).toBe(true);
    expect(packFormatFromName("fn.lambda.zip")).toBe("serverless");
    expect(packFormatFromName("fn.serverless.zip")).toBe("serverless");
    expect(packFormatFromName("fn.zip")).toBe("zip");
    expect(isPackAssetName("dist/fn.lambda.zip")).toBe(true);
    expect(SERVERLESS_NOTE).toMatch(/never executed/i);
    expect(SERVERLESS_NOTE).toMatch(/not decrypted/i);
  });
});

describe("serverless packed scans", () => {
  it("scans clean and dirty Lambda zips without executing handlers", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-serverless-"));
    try {
      await writeZip(path.join(dir, "clean.lambda.zip"), {
        "host.json": HOST,
        "index.js": "export const handler = () => ({ ok: true })\n",
        "package.json": '{"name":"clean-fn"}',
      });
      await writeZip(path.join(dir, "dirty.lambda.zip"), {
        "host.json": HOST,
        "index.js": JS,
        "index.js.map": MAP,
        "package.json": '{"name":"spoiler-fn"}',
      });
      await writeZip(path.join(dir, "azure.zip"), {
        "host.json": HOST,
        "Hello/function.json": '{"bindings":[]}',
        "Hello/index.js": JS,
        "Hello/index.js.map": MAP,
      });
      await writeZip(path.join(dir, "netlify.zip"), {
        "netlify/functions/hello.js": JS,
        "netlify/functions/hello.js.map": MAP,
      });

      const clean = await scan(path.join(dir, "clean.lambda.zip"));
      expect(clean.kind).toBe("serverless");
      expect(clean.ok).toBe(true);
      expect(clean.status).toBe("passed");

      const dirty = await scan(path.join(dir, "dirty.lambda.zip"));
      expect(dirty.kind).toBe("serverless");
      expect(dirty.findings.some((row) => row.rule === "MAP-001")).toBe(true);
      expect(JSON.stringify(dirty.findings)).not.toMatch(/export const secret = 1/);

      const azure = await scan(path.join(dir, "azure.zip"));
      expect(azure.kind).toBe("serverless");
      expect(azure.findings.some((row) => row.rule === "MAP-001")).toBe(true);

      const netlify = await scan(path.join(dir, "netlify.zip"));
      expect(netlify.kind).toBe("serverless");
      expect(netlify.findings.some((row) => row.rule === "MAP-001")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("classifies a disguised zip by layout, not the filename", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-serverless-magic-"));
    try {
      const dest = path.join(dir, "notes.bin");
      await writeZip(dest, {
        "host.json": HOST,
        "index.js": JS,
        "index.js.map": MAP,
      });
      const bytes = await readFile(dest);
      expect(sniffPackFormat(bytes, "notes.bin")).toBe("serverless");
      const report = await scan(dest);
      expect(report.kind).toBe("serverless");
      expect(report.findings.some((row) => row.rule === "MAP-001")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not steal VSIX or APK names when those layouts are present", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", "<Types></Types>");
    zip.file("extension.vsixmanifest", "<PackageManifest></PackageManifest>");
    zip.file("host.json", HOST);
    const vsix = await zip.generateAsync({ type: "nodebuffer" });
    expect(sniffPackFormat(vsix, "theme.vsix")).toBe("vsix");

    const apk = new JSZip();
    apk.file("AndroidManifest.xml", "<manifest></manifest>");
    apk.file("classes.dex", Buffer.from("dex\n035\0", "latin1"));
    apk.file("host.json", HOST);
    const apkBytes = await apk.generateAsync({ type: "nodebuffer" });
    expect(sniffPackFormat(apkBytes, "app.apk")).toBe("apk");
  });

  it("marks an encrypted Lambda zip inconclusive and does not decrypt it", async () => {
    const dest = path.join(os.tmpdir(), `ns-enc-lambda-${Date.now()}.lambda.zip`);
    try {
      await writeFile(dest, encryptedZipStub());
      const report = await scan(dest);
      expect(report.kind).toBe("serverless");
      expect(report.status).toBe("inconclusive");
      expect(report.inconclusiveReason).toBe(ENCRYPTION_INCONCLUSIVE);
    } finally {
      await rm(dest, { force: true });
    }
  });

  it("keeps expansion limits and does not execute the handler", async () => {
    const dest = path.join(os.tmpdir(), `ns-lambda-limit-${Date.now()}.lambda.zip`);
    try {
      await writeZip(dest, {
        "host.json": HOST,
        "index.js": "export const handler = () => ({ ok: true })\n",
        "payload.txt": "x".repeat(80_000),
      });
      const report = await scan(dest, { maxUnpackedBytes: 10_000 });
      expect(report.kind).toBe("serverless");
      expect(report.status).toBe("inconclusive");
      expect(report.inconclusiveReason).toMatch(/unpacked limit/);
    } finally {
      await rm(dest, { force: true });
    }
  });
});
