import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scan } from "../src/scanner/index.ts";

async function withDir(files: Record<string, string>, run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ns-test-"));
  try {
    for (const [rel, contents] of Object.entries(files)) {
      await writeFile(path.join(dir, rel), contents);
    }
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("scan", () => {
  it("passes a clean dist folder", async () => {
    await withDir({ "index.js": "console.log(1)" }, async (dir) => {
      const report = await scan(dir);
      expect(report.ok).toBe(true);
      expect(report.findings).toEqual([]);
    });
  });

  it("fails when a source map embeds original source", async () => {
    const map = JSON.stringify({
      version: 3,
      sources: ["src/app.ts"],
      sourcesContent: ["export const secret = 1\n"],
      mappings: "AAAA",
    });
    await withDir(
      {
        "index.js": "export const secret=1\n//# sourceMappingURL=index.js.map\n",
        "index.js.map": map,
      },
      async (dir) => {
        const report = await scan(dir);
        expect(report.ok).toBe(false);
        const rules = report.findings.map((f) => f.rule);
        expect(rules).toContain("MAP-001");
        expect(rules).toContain("MAP-002");
        expect(rules).toContain("MAP-003");
      },
    );
  });

  it("fails when a .env file is packed", async () => {
    await withDir({ ".env": "TOKEN=abc", "index.js": "ok" }, async (dir) => {
      const report = await scan(dir);
      expect(report.ok).toBe(false);
      expect(report.findings.some((f) => f.rule === "SEC-001")).toBe(true);
    });
  });

  it("fails an Electron asar that contains a source map", async () => {
    const { createPackage } = await import("@electron/asar");
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-asar-"));
    const dest = path.join(os.tmpdir(), `ns-asar-${Date.now()}.asar`);
    try {
      await writeFile(
        path.join(dir, "index.js.map"),
        JSON.stringify({ version: 3, sources: ["a.ts"], mappings: "AAAA" }),
      );
      await writeFile(path.join(dir, "index.js"), "ok\n");
      await createPackage(dir, dest);
      const report = await scan(dest);
      expect(report.ok).toBe(false);
      expect(report.kind).toBe("asar");
      expect(report.findings.some((f) => f.rule === "MAP-001")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
      await rm(dest, { force: true });
    }
  });

  it("warns on TypeScript source without failing", async () => {
    await withDir({ "app.ts": "export const n = 1" }, async (dir) => {
      const report = await scan(dir);
      expect(report.ok).toBe(true);
      expect(report.findings[0]?.rule).toBe("SRC-001");
      const strict = await scan(dir, { strict: true });
      expect(strict.ok).toBe(false);
    });
  });
});
