import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  ENCRYPTION_INCONCLUSIVE,
  MOBILE_SIGNING_NOTE,
  packFormatFromName,
  sniffMobileLayout,
  sniffPackFormat,
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
const DEX = Buffer.from("dex\n035\0", "latin1");

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

describe("APK/AAB/IPA layout sniff", () => {
  it("classifies mobile layouts from entry names, not the extension", () => {
    expect(sniffMobileLayout(["index.js"])).toBeNull();
    expect(sniffMobileLayout(["AndroidManifest.xml", "classes.dex"])).toBe("apk");
    expect(sniffMobileLayout(["BundleConfig.pb", "base/manifest/AndroidManifest.xml"])).toBe("aab");
    expect(sniffMobileLayout(["Payload/Spoiler.app/Info.plist"])).toBe("ipa");
    expect(packFormatFromName("app.apk")).toBe("apk");
    expect(packFormatFromName("app.aab")).toBe("aab");
    expect(packFormatFromName("app.ipa")).toBe("ipa");
    expect(isPackAssetName("dist/app.apk")).toBe(true);
    expect(isPackAssetName("dist/app.ipa")).toBe(true);
    expect(MOBILE_SIGNING_NOTE).toMatch(/not verified/i);
    expect(MOBILE_SIGNING_NOTE).toMatch(/never executed/i);
  });
});

describe("APK/AAB/IPA packed scans", () => {
  it("scans clean and dirty APK, AAB, and IPA as ZIP by magic", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-mobile-"));
    try {
      await writeZip(path.join(dir, "clean.apk"), {
        "AndroidManifest.xml": "<manifest></manifest>",
        "classes.dex": DEX,
        "assets/www/index.js": "console.log(1)\n",
      });
      await writeZip(path.join(dir, "dirty.apk"), {
        "AndroidManifest.xml": "<manifest></manifest>",
        "classes.dex": DEX,
        "META-INF/CERT.RSA": Buffer.from("not-a-real-signature"),
        "assets/www/index.js": JS,
        "assets/www/index.js.map": MAP,
      });
      await writeZip(path.join(dir, "dirty.aab"), {
        "BundleConfig.pb": Buffer.from("pb"),
        "base/manifest/AndroidManifest.xml": "<manifest></manifest>",
        "base/dex/classes.dex": DEX,
        "base/assets/www/index.js": JS,
        "base/assets/www/index.js.map": MAP,
      });
      await writeZip(path.join(dir, "dirty.ipa"), {
        "Payload/Spoiler.app/Info.plist": "<plist></plist>",
        "Payload/Spoiler.app/www/index.js": JS,
        "Payload/Spoiler.app/www/index.js.map": MAP,
      });
      const asBin = path.join(dir, "notes.bin");
      await writeZip(asBin, {
        "AndroidManifest.xml": "<manifest></manifest>",
        "classes.dex": DEX,
        "assets/www/index.js": JS,
        "assets/www/index.js.map": MAP,
      });

      const clean = await scan(path.join(dir, "clean.apk"));
      expect(clean.kind).toBe("apk");
      expect(clean.status).toBe("passed");
      expect(clean.ok).toBe(true);

      const dirty = await scan(path.join(dir, "dirty.apk"));
      expect(dirty.kind).toBe("apk");
      expect(dirty.status).toBe("failed-policy");
      expect(dirty.findings.map((row) => row.rule)).toEqual(
        expect.arrayContaining(["MAP-001", "MAP-002", "MAP-003"]),
      );
      expect(JSON.stringify(dirty)).not.toContain("export const secret = 1");

      const aab = await scan(path.join(dir, "dirty.aab"));
      expect(aab.kind).toBe("aab");
      expect(aab.findings.some((row) => row.rule === "MAP-001")).toBe(true);

      const ipa = await scan(path.join(dir, "dirty.ipa"));
      expect(ipa.kind).toBe("ipa");
      expect(ipa.findings.some((row) => row.rule === "MAP-001")).toBe(true);

      const bytes = await readFile(asBin);
      expect(sniffPackFormat(bytes, "notes.bin")).toBe("apk");
      const disguised = await scan(asBin);
      expect(disguised.kind).toBe("apk");
      expect(disguised.findings.some((row) => row.rule === "MAP-001")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("marks an encrypted APK inconclusive and does not decrypt it", async () => {
    const dest = path.join(os.tmpdir(), `ns-enc-apk-${Date.now()}.apk`);
    try {
      await writeFile(dest, encryptedZipStub());
      const report = await scan(dest);
      expect(report.kind).toBe("apk");
      expect(report.status).toBe("inconclusive");
      expect(report.inconclusiveReason).toBe(ENCRYPTION_INCONCLUSIVE);
    } finally {
      await rm(dest, { force: true });
    }
  });

  it("keeps expansion limits and does not execute DEX", async () => {
    const dest = path.join(os.tmpdir(), `ns-apk-limit-${Date.now()}.apk`);
    try {
      await writeZip(dest, {
        "AndroidManifest.xml": "<manifest></manifest>",
        "classes.dex": DEX,
        "payload.txt": "x".repeat(80_000),
      });
      const report = await scan(dest, { maxUnpackedBytes: 10_000 });
      expect(report.kind).toBe("apk");
      expect(report.status).toBe("inconclusive");
      expect(report.inconclusiveReason).toMatch(/unpacked limit/);
    } finally {
      await rm(dest, { force: true });
    }
  });
});
