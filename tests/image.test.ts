import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { c as tarCreate } from "tar";
import {
  IMAGE_ENCRYPTION_INCONCLUSIVE,
  isImageLayerPath,
  packFormatFromName,
  sniffImageLayout,
  sniffPackFormat,
} from "../src/scanner/formats.ts";
import { isOverlayWhiteout } from "../src/scanner/inspect.ts";
import { scan } from "../src/scanner/index.ts";
import { isPackAssetName } from "../src/server/paths.ts";
import { writeDockerSave, writeOciArchive } from "../scripts/image-archive.ts";

const MAP = JSON.stringify({
  version: 3,
  sources: ["src/app.ts"],
  sourcesContent: ["export const secret = 1\n"],
  mappings: "AAAA",
});
const JS = "export const secret=1\n//# sourceMappingURL=index.js.map\n";
const HEX = "ab".repeat(32);

function ustarFile(name: string, body: string): Buffer {
  const data = Buffer.from(body);
  const header = Buffer.alloc(512);
  header.write(name.slice(0, 99), 0, Math.min(name.length, 100), "utf8");
  header.write("0000644\0", 100, 8, "utf8");
  header.write("0000000\0", 108, 8, "utf8");
  header.write("0000000\0", 116, 8, "utf8");
  header.write(`${data.length.toString(8).padStart(11, "0")}\0`, 124, 12, "utf8");
  header.write("00000000000\0", 136, 12, "utf8");
  header.write("        ", 148, 8, "utf8");
  header.write("0", 156, 1, "utf8");
  header.write("ustar", 257, 5, "latin1");
  header.write("00", 263, 2, "latin1");
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8, "utf8");
  const pad = (512 - (data.length % 512)) % 512;
  return Buffer.concat([header, data, Buffer.alloc(pad)]);
}

function storedTar(files: Record<string, string>): Buffer {
  const parts = Object.entries(files).map(([name, body]) => ustarFile(name, body));
  return Buffer.concat([...parts, Buffer.alloc(1024)]);
}

describe("Docker/OCI layout sniff", () => {
  it("classifies docker save, OCI layout, and ordinary tarballs from paths", () => {
    expect(sniffImageLayout(["package/package.json", "package/index.js"])).toBeNull();
    expect(sniffImageLayout(["index.json"])).toBeNull();
    expect(sniffImageLayout(["manifest.json"])).toBeNull();
    expect(sniffImageLayout(["manifest.json", "layer0/layer.tar"])).toBe("docker");
    expect(sniffImageLayout(["oci-layout", "index.json", `blobs/sha256/${HEX}`])).toBe("oci");
    expect(sniffImageLayout(["index.json", `blobs/sha256/${HEX}`])).toBe("oci");
    expect(isImageLayerPath(`blobs/sha256/${HEX}`)).toBe(true);
    expect(isImageLayerPath("layer0/layer.tar")).toBe(true);
    expect(isImageLayerPath("package.json")).toBe(false);
    expect(isOverlayWhiteout(".wh..env")).toBe(true);
    expect(isOverlayWhiteout(".wh..wh..opq")).toBe(true);
    expect(isOverlayWhiteout(".env")).toBe(false);
  });

  it("treats docker save names as GitHub release packs", () => {
    expect(packFormatFromName("app.docker.tar")).toBe("docker");
    expect(packFormatFromName("app.oci.tar")).toBe("oci");
    expect(isPackAssetName("dist/app.docker.tar")).toBe(true);
    expect(isPackAssetName("image.tar")).toBe(true);
  });
});

describe("Docker/OCI packed scans", () => {
  it("scans clean and dirty docker save images", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-docker-"));
    try {
      await writeDockerSave(path.join(dir, "clean.tar"), [{ "index.js": "console.log(1)\n" }]);
      await writeDockerSave(path.join(dir, "dirty.tar"), [
        { "index.js": JS, "index.js.map": MAP },
      ]);
      const clean = await scan(path.join(dir, "clean.tar"));
      expect(clean.kind).toBe("docker");
      expect(clean.status).toBe("passed");
      expect(clean.ok).toBe(true);

      const dirty = await scan(path.join(dir, "dirty.tar"));
      expect(dirty.kind).toBe("docker");
      expect(dirty.status).toBe("failed-policy");
      expect(dirty.findings.map((row) => row.rule)).toEqual(
        expect.arrayContaining(["MAP-001", "MAP-002", "MAP-003"]),
      );
      expect(JSON.stringify(dirty)).not.toContain("export const secret = 1");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("scans an OCI archive by blob digest, not the extension", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-oci-"));
    try {
      const dest = path.join(dir, "notes.bin");
      await writeOciArchive(dest, { "index.js": JS, "index.js.map": MAP });
      const bytes = await readFile(dest);
      expect(sniffPackFormat(bytes, "notes.bin")).toBe("tarball");
      const report = await scan(dest);
      expect(report.kind).toBe("oci");
      expect(report.findings.some((row) => row.rule === "MAP-001")).toBe(true);
      expect(report.manifest.some((row) => row.path.includes("blobs/sha256/"))).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not apply overlay whiteouts and still finds lower-layer spoilers", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-wh-"));
    try {
      const dest = path.join(dir, "whiteout.tar");
      await writeDockerSave(dest, [
        { ".env": "STRIPE_SECRET_KEY=sk_live_example\n", "index.js": "console.log(1)\n" },
        { ".wh..env": "", "index.js": "console.log(2)\n" },
      ]);
      const report = await scan(dest);
      expect(report.kind).toBe("docker");
      expect(report.findings.some((row) => row.rule === "SEC-001")).toBe(true);
      expect(report.findings.some((row) => row.path.includes(".wh."))).toBe(false);
      expect(JSON.stringify(report)).not.toContain("sk_live_example");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("marks encrypted OCI layers inconclusive and does not unpack them", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-enc-oci-"));
    try {
      const dest = path.join(dir, "enc.oci.tar");
      await writeOciArchive(dest, { "index.js": JS, "index.js.map": MAP }, { encrypted: true });
      const report = await scan(dest);
      expect(report.kind).toBe("oci");
      expect(report.status).toBe("inconclusive");
      expect(report.inconclusiveReason).toBe(IMAGE_ENCRYPTION_INCONCLUSIVE);
      expect(report.findings).toEqual([]);
      expect(JSON.stringify(report)).not.toContain("export const secret = 1");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("flags zip-slip names inside a layer tar without using them as paths", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-img-slip-"));
    try {
      const root = path.join(dir, "root");
      const layerDir = path.join(root, "layer0");
      await mkdir(layerDir, { recursive: true });
      await writeFile(
        path.join(layerDir, "layer.tar"),
        storedTar({
          "../escape.env": "STRIPE_SECRET_KEY=sk_live_example\n",
          "ok.js": "console.log(1)\n",
        }),
      );
      await writeFile(path.join(layerDir, "VERSION"), "1.0\n");
      await writeFile(
        path.join(root, "manifest.json"),
        JSON.stringify([{ Config: "config.json", RepoTags: ["x:latest"], Layers: ["layer0/layer.tar"] }]),
      );
      await writeFile(path.join(root, "config.json"), "{}");
      const dest = path.join(dir, "slip.tar");
      await tarCreate({ file: dest, cwd: root, portable: true, mtime: new Date(0) }, ["."]);
      const report = await scan(dest);
      expect(report.kind).toBe("docker");
      expect(report.findings.some((row) => row.rule === "ARC-002")).toBe(true);
      expect(report.status).toBe("failed-policy");
      expect(JSON.stringify(report)).not.toContain("sk_live_example");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("keeps expansion limits on a docker save", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-img-limit-"));
    try {
      const dest = path.join(dir, "big.tar");
      await writeDockerSave(dest, [{ "payload.txt": "x".repeat(80_000) }]);
      const report = await scan(dest, { maxUnpackedBytes: 10_000 });
      expect(report.kind).toBe("docker");
      expect(report.status).toBe("inconclusive");
      expect(report.inconclusiveReason).toMatch(/unpacked limit/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not call docker or execute layer contents", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-img-exec-"));
    try {
      const dest = path.join(dir, "image.tar");
      await writeDockerSave(dest, [
        {
          "bin/payload.sh": "#!/bin/sh\necho executed\n",
          "index.js": "console.log(1)\n",
        },
      ]);
      const report = await scan(dest);
      expect(report.kind).toBe("docker");
      expect(report.status).toBe("passed");
      expect(report.ok).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
