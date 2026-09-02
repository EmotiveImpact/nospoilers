import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { c as tarCreate } from "tar";
import {
  PYTHON_NOTE,
  packFormatFromName,
  sniffPackFormat,
  sniffSdistLayout,
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

async function writeTar(dest: string, files: Record<string, string>): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ns-sdist-tree-"));
  try {
    for (const [rel, contents] of Object.entries(files)) {
      const abs = path.join(dir, rel);
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, contents);
    }
    await tarCreate({ gzip: true, file: dest, cwd: dir }, ["."]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("Python sdist layout sniff", () => {
  it("classifies PKG-INFO layout, not a generic npm tarball", () => {
    expect(sniffSdistLayout(["package.json", "index.js"])).toBe(false);
    expect(sniffSdistLayout(["spoiler-1.0.0/PKG-INFO", "spoiler-1.0.0/pyproject.toml"])).toBe(true);
    expect(sniffSdistLayout(["PKG-INFO"])).toBe(true);
    expect(sniffSdistLayout(["spoiler-1.0.0/spoiler.egg-info/PKG-INFO"])).toBe(true);
    expect(sniffSdistLayout(["deep/nested/vendor/PKG-INFO"])).toBe(false);
    expect(packFormatFromName("spoiler-1.0.0.tar.gz")).toBe("tarball");
    expect(isPackAssetName("dist/spoiler-1.0.0.tar.gz")).toBe(true);
    expect(PYTHON_NOTE).toMatch(/not executed/i);
    expect(PYTHON_NOTE).toMatch(/PKG-INFO/);
  });
});

describe("Python sdist packed scans", () => {
  it("scans clean and dirty sdists as tar by magic and PKG-INFO layout", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-sdist-"));
    try {
      await writeTar(path.join(dir, "clean.sdist.tgz"), {
        "clean-1.0.0/PKG-INFO": "Metadata-Version: 2.1\nName: clean\nVersion: 1.0.0\n",
        "clean-1.0.0/pyproject.toml": '[project]\nname = "clean"\nversion = "1.0.0"\n',
        "clean-1.0.0/src/clean/__init__.py": "x = 1\n",
      });
      await writeTar(path.join(dir, "dirty.sdist.tgz"), {
        "spoiler-1.0.0/PKG-INFO": "Metadata-Version: 2.1\nName: spoiler\nVersion: 1.0.0\n",
        "spoiler-1.0.0/src/spoiler/static/index.js": JS,
        "spoiler-1.0.0/src/spoiler/static/index.js.map": MAP,
      });
      await writeTar(path.join(dir, "npm.tgz"), {
        "package.json": '{"name":"spoiler-pack"}',
        "index.js": "console.log(1)\n",
      });

      const clean = await scan(path.join(dir, "clean.sdist.tgz"));
      expect(clean.kind).toBe("sdist");
      expect(clean.status).toBe("passed");
      expect(clean.ok).toBe(true);
      expect(clean.findings).toEqual([]);

      const dirty = await scan(path.join(dir, "dirty.sdist.tgz"));
      expect(dirty.kind).toBe("sdist");
      expect(dirty.status).toBe("failed-policy");
      expect(dirty.findings.map((row) => row.rule)).toEqual(
        expect.arrayContaining(["MAP-001", "MAP-002", "MAP-003"]),
      );
      expect(JSON.stringify(dirty)).not.toMatch(/export const secret = 1/);

      const npm = await scan(path.join(dir, "npm.tgz"));
      expect(npm.kind).toBe("tarball");
      expect(sniffPackFormat(await readFile(path.join(dir, "npm.tgz")), "npm.tgz")).toBe("tarball");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("keeps unpacked size limits on an sdist", async () => {
    const dest = path.join(os.tmpdir(), `ns-sdist-limit-${Date.now()}.tgz`);
    try {
      await writeTar(dest, {
        "pkg-1.0.0/PKG-INFO": "Name: pkg\nVersion: 1.0.0\n",
        "pkg-1.0.0/payload.txt": "x".repeat(100_000),
      });
      const report = await scan(dest, { maxUnpackedBytes: 10_000 });
      expect(report.kind).toBe("sdist");
      expect(report.status).toBe("inconclusive");
      expect(report.inconclusiveReason).toMatch(/unpacked limit/);
    } finally {
      await rm(dest, { force: true });
    }
  });
});
