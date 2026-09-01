import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { crc32, gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { c as tarCreate } from "tar";
import {
  CRX_INCONCLUSIVE,
  ENCRYPTION_INCONCLUSIVE,
  listZipEntryNames,
  packFormatFromName,
  sniffPackFormat,
  unwrapCrx,
  zipUsesEncryption,
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

async function writeZip(dest: string, files: Record<string, string | Buffer>): Promise<void> {
  const zip = new JSZip();
  for (const [name, contents] of Object.entries(files)) {
    zip.file(name, contents);
  }
  await writeFile(dest, await zip.generateAsync({ type: "nodebuffer" }));
}

/** Store entry names verbatim. JSZip collapses `..` on both write and load. */
async function writeStoredZip(dest: string, files: Record<string, string | Buffer>): Promise<void> {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  const entries = Object.entries(files);
  for (const [name, contents] of entries) {
    const data = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc >>> 0, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    const localFull = Buffer.concat([local, nameBuf, data]);
    locals.push(localFull);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc >>> 0, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, nameBuf]));
    offset += localFull.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  await writeFile(dest, Buffer.concat([...locals, cd, eocd]));
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

function crx3FromZip(zip: Buffer): Buffer {
  const buf = Buffer.alloc(12 + zip.length);
  buf.write("Cr24", 0, 4, "latin1");
  buf.writeUInt32LE(3, 4);
  buf.writeUInt32LE(0, 8);
  zip.copy(buf, 12);
  return buf;
}

describe("extra packed formats", () => {
  it("classifies zip-family names and GitHub release assets", () => {
    expect(packFormatFromName("app.vsix")).toBe("vsix");
    expect(packFormatFromName("app.crx")).toBe("crx");
    expect(packFormatFromName("app.xpi")).toBe("xpi");
    expect(packFormatFromName("pkg-1.0.0-py3-none-any.whl")).toBe("wheel");
    expect(packFormatFromName("app.jar")).toBe("jar");
    expect(packFormatFromName("app.war")).toBe("jar");
    expect(packFormatFromName("App.1.0.0.nupkg")).toBe("nupkg");
    expect(packFormatFromName("App.1.0.0.snupkg")).toBe("nupkg");
    expect(packFormatFromName("spoiler-1.0.0.gem")).toBe("gem");
    expect(packFormatFromName("app.apk")).toBe("apk");
    expect(packFormatFromName("app.aab")).toBe("aab");
    expect(packFormatFromName("app.ipa")).toBe("ipa");
    expect(packFormatFromName("fn.lambda.zip")).toBe("serverless");
    expect(packFormatFromName("fn.serverless.zip")).toBe("serverless");
    expect(isPackAssetName("dist/app.vsix")).toBe(true);
    expect(isPackAssetName("dist/app.apk")).toBe(true);
    expect(isPackAssetName("dist/fn.lambda.zip")).toBe(true);
    expect(isPackAssetName("README.md")).toBe(false);
  });

  it("prefers ZIP/CRX magic over a misleading extension", async () => {
    const zip = new JSZip();
    zip.file("index.js", "ok");
    const bytes = await zip.generateAsync({ type: "nodebuffer" });
    expect(sniffPackFormat(bytes, "notes.js")).toBe("zip");
    expect(sniffPackFormat(crx3FromZip(bytes), "notes.js")).toBe("crx");
    expect(sniffPackFormat(bytes, "theme.vsix")).toBe("vsix");
  });

  it("scans clean and dirty VSIX, wheel, JAR, nupkg, and XPI as ZIP", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-fmt-"));
    try {
      const dirty = {
        "index.js": JS,
        "index.js.map": MAP,
      };
      await writeZip(path.join(dir, "clean.vsix"), {
        "[Content_Types].xml": '<?xml version="1.0"?><Types></Types>',
        "extension.vsixmanifest": "<PackageManifest></PackageManifest>",
        "extension/index.js": "console.log(1)",
      });
      await writeZip(path.join(dir, "dirty.vsix"), {
        "[Content_Types].xml": '<?xml version="1.0"?><Types></Types>',
        "extension.vsixmanifest": "<PackageManifest></PackageManifest>",
        "extension/index.js": JS,
        "extension/index.js.map": MAP,
      });
      await writeZip(path.join(dir, "clean.whl"), {
        "pkg-1.0.0.dist-info/METADATA": "Name: pkg\nVersion: 1.0.0\n",
        "pkg/__init__.py": "x = 1\n",
      });
      await writeZip(path.join(dir, "dirty.whl"), {
        "pkg-1.0.0.dist-info/METADATA": "Name: pkg\nVersion: 1.0.0\n",
        "pkg/static/index.js": JS,
        "pkg/static/index.js.map": MAP,
      });
      await writeZip(path.join(dir, "dirty.jar"), {
        "META-INF/MANIFEST.MF": "Manifest-Version: 1.0\n",
        ...dirty,
      });
      await writeZip(path.join(dir, "dirty.nupkg"), {
        "[Content_Types].xml": '<?xml version="1.0"?><Types></Types>',
        "App.nuspec": "<package></package>",
        ...dirty,
      });
      await writeZip(path.join(dir, "dirty.xpi"), {
        "manifest.json": '{"manifest_version":2,"name":"x"}',
        ...dirty,
      });

      const cleanVsix = await scan(path.join(dir, "clean.vsix"));
      expect(cleanVsix.kind).toBe("vsix");
      expect(cleanVsix.status).toBe("passed");
      expect(cleanVsix.ok).toBe(true);

      const dirtyVsix = await scan(path.join(dir, "dirty.vsix"));
      expect(dirtyVsix.kind).toBe("vsix");
      expect(dirtyVsix.status).toBe("failed-policy");
      expect(dirtyVsix.findings.map((row) => row.rule)).toEqual(
        expect.arrayContaining(["MAP-001", "MAP-002", "MAP-003"]),
      );

      const cleanWhl = await scan(path.join(dir, "clean.whl"));
      expect(cleanWhl.kind).toBe("wheel");
      expect(cleanWhl.ok).toBe(true);

      const dirtyWhl = await scan(path.join(dir, "dirty.whl"));
      expect(dirtyWhl.kind).toBe("wheel");
      expect(dirtyWhl.findings.some((row) => row.rule === "MAP-001")).toBe(true);

      const jar = await scan(path.join(dir, "dirty.jar"));
      expect(jar.kind).toBe("jar");
      expect(jar.findings.some((row) => row.rule === "MAP-001")).toBe(true);

      const nupkg = await scan(path.join(dir, "dirty.nupkg"));
      expect(nupkg.kind).toBe("nupkg");
      expect(nupkg.findings.some((row) => row.rule === "MAP-001")).toBe(true);

      const xpi = await scan(path.join(dir, "dirty.xpi"));
      expect(xpi.kind).toBe("xpi");
      expect(xpi.findings.some((row) => row.rule === "MAP-001")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("strips a CRX3 header and scans the ZIP payload", async () => {
    const zip = new JSZip();
    zip.file("index.js", JS);
    zip.file("index.js.map", MAP);
    const packed = crx3FromZip(await zip.generateAsync({ type: "nodebuffer" }));
    expect(unwrapCrx(packed)?.subarray(0, 2).toString("hex")).toBe("504b");
    const dest = path.join(os.tmpdir(), `ns-crx-${Date.now()}.crx`);
    try {
      await writeFile(dest, packed);
      const report = await scan(dest);
      expect(report.kind).toBe("crx");
      expect(report.findings.some((row) => row.rule === "MAP-001")).toBe(true);
    } finally {
      await rm(dest, { force: true });
    }
  });

  it("marks a CRX wrapper without a ZIP payload as inconclusive", async () => {
    const dest = path.join(os.tmpdir(), `ns-crx-bad-${Date.now()}.crx`);
    try {
      const buf = Buffer.alloc(16);
      buf.write("Cr24", 0, 4, "latin1");
      buf.writeUInt32LE(3, 4);
      buf.writeUInt32LE(0, 8);
      await writeFile(dest, buf);
      const report = await scan(dest);
      expect(report.status).toBe("inconclusive");
      expect(report.inconclusiveReason).toBe(CRX_INCONCLUSIVE);
    } finally {
      await rm(dest, { force: true });
    }
  });

  it("marks encrypted zip entries as inconclusive", async () => {
    expect(zipUsesEncryption(encryptedZipStub())).toBe(true);
    const dest = path.join(os.tmpdir(), `ns-enc-${Date.now()}.zip`);
    try {
      await writeFile(dest, encryptedZipStub());
      const report = await scan(dest);
      expect(report.status).toBe("inconclusive");
      expect(report.inconclusiveReason).toBe(ENCRYPTION_INCONCLUSIVE);
    } finally {
      await rm(dest, { force: true });
    }
  });

  it("flags zip-slip entry names without using them as filesystem paths", async () => {
    const dest = path.join(os.tmpdir(), `ns-slip-${Date.now()}.zip`);
    try {
      await writeStoredZip(dest, {
        "../escape.env": "STRIPE_SECRET_KEY=sk_live_example\n",
        "ok.js": "console.log(1)",
      });
      expect(listZipEntryNames(await readFile(dest))).toContain("../escape.env");
      const report = await scan(dest);
      expect(report.findings.some((row) => row.rule === "ARC-002")).toBe(true);
      expect(report.status).toBe("failed-policy");
      expect(JSON.stringify(report)).not.toContain("sk_live_example");
    } finally {
      await rm(dest, { force: true });
    }
  });

  it("scans a Ruby gem as tar and unpacks nested data.tar.gz", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-gem-"));
    try {
      const inner = path.join(dir, "inner");
      await mkdir(inner);
      await writeFile(path.join(inner, "index.js"), JS);
      await writeFile(path.join(inner, "index.js.map"), MAP);
      await tarCreate({ gzip: true, file: path.join(dir, "data.tar.gz"), cwd: inner }, ["."]);
      await writeFile(path.join(dir, "metadata.gz"), gzipSync("---\nname: spoiler\nversion: 1.0.0\n"));
      const gem = path.join(dir, "spoiler-1.0.0.gem");
      await tarCreate({ file: gem, cwd: dir }, ["data.tar.gz", "metadata.gz"]);
      const report = await scan(gem);
      expect(report.kind).toBe("gem");
      expect(report.findings.some((row) => row.rule === "MAP-001")).toBe(true);
      expect(report.findings.some((row) => row.rule === "ARC-001")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("keeps zip expansion, file-count, and timeout limits", async () => {
    const dest = path.join(os.tmpdir(), `ns-whl-limit-${Date.now()}.whl`);
    try {
      await writeZip(dest, { "payload.txt": "x".repeat(100_000) });
      const report = await scan(dest, { maxUnpackedBytes: 10_000 });
      expect(report.kind).toBe("wheel");
      expect(report.status).toBe("inconclusive");
      expect(report.inconclusiveReason).toMatch(/unpacked limit/);
    } finally {
      await rm(dest, { force: true });
    }
  });
});
