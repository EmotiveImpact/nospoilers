import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { c as tarCreate } from "tar";
import { FILE_WARN_BYTES } from "../src/scanner/inspect.ts";
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
      expect(report.status).toBe("passed");
      expect(report.findings).toEqual([]);
      expect(report.manifest.length).toBe(1);
      expect(report.manifest[0]?.path).toMatch(/index\.js$/);
      expect(report.manifest[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
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
        expect(report.status).toBe("failed-policy");
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

  it("finds high-confidence access tokens without echoing their values", async () => {
    const token = `ghp_${"A".repeat(36)}`;
    await withDir({ "config.js": `export const token = "${token}"` }, async (dir) => {
      const report = await scan(dir);
      expect(report.ok).toBe(false);
      const finding = report.findings.find((row) => row.rule === "SEC-003");
      expect(finding).toBeDefined();
      expect(JSON.stringify(finding)).not.toContain(token);
    });
  });

  it("flags credential configuration files and assigned credentials", async () => {
    await withDir(
      { ".npmrc": "_authToken=AbCDefghijkLMNopqrstUVWXyz012345\n" },
      async (dir) => {
        const report = await scan(dir);
        expect(report.findings.map((row) => row.rule)).toEqual(
          expect.arrayContaining(["SEC-003", "SEC-004"]),
        );
      },
    );
  });

  it("flags cloud credentials, PKCS bundles, build caches, and extra AI/MCP files", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-inspect-"));
    try {
      await writeFile(
        path.join(dir, "sa.json"),
        JSON.stringify({ type: "service_account", project_id: "demo" }),
      );
      await writeFile(
        path.join(dir, "azure.env"),
        "DefaultEndpointsProtocol=https;AccountName=examplestorage;AccountKey=not-a-real-key\n",
      );
      await writeFile(path.join(dir, "client.pfx"), "pkcs12-bytes");
      await writeFile(path.join(dir, "terraform.tfstate"), '{"version":4}');
      await writeFile(path.join(dir, "claude_desktop_config.json"), '{"mcpServers":{}}');
      await mkdir(path.join(dir, ".turbo"), { recursive: true });
      await writeFile(path.join(dir, ".turbo", "cache.json"), "{}");
      await mkdir(path.join(dir, ".continue"), { recursive: true });
      await writeFile(path.join(dir, ".continue", "config.json"), "{}");
      const report = await scan(dir);
      const rules = report.findings.map((row) => `${row.rule}:${row.path}`);
      expect(rules).toEqual(
        expect.arrayContaining([
          "SEC-003:sa.json",
          "SEC-003:azure.env",
          "SEC-002:client.pfx",
          "SEC-004:terraform.tfstate",
          "AI-001:claude_desktop_config.json",
          "AI-001:.continue/config.json",
          "CACHE-001:.turbo/cache.json",
        ]),
      );
      expect(JSON.stringify(report.findings)).not.toContain("not-a-real-key");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("warns on AI context, internal locations, and debug artifacts", async () => {
    await withDir(
      {
        "AGENTS.md": "Internal release instructions",
        "bundle.js": 'fetch("http://10.2.3.4/internal")\n// /Users/alice/product/src',
        "app.pdb": "debug symbols",
      },
      async (dir) => {
        const report = await scan(dir);
        expect(report.ok).toBe(true);
        expect(report.findings.map((row) => row.rule)).toEqual(
          expect.arrayContaining(["AI-001", "NET-001", "DBG-001"]),
        );
      },
    );
  });

  it("fails crash dumps and ELF cores without executing them", async () => {
    const minidump = Buffer.concat([Buffer.from("MDMP"), Buffer.alloc(12, 0)]);
    const elfCore = Buffer.from([
      0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x04, 0x00, 0x00, 0x00,
    ]);
    const elfShared = Buffer.from([
      0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x03, 0x00, 0x00, 0x00,
    ]);
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-crash-"));
    try {
      await writeFile(path.join(dir, "core"), "deadbeef");
      await writeFile(path.join(dir, "core.4412"), "deadbeef");
      await writeFile(path.join(dir, "app.dmp"), minidump);
      await writeFile(path.join(dir, "anonymous.bin"), elfCore);
      await writeFile(path.join(dir, "libfoo.so"), elfShared);
      await writeFile(path.join(dir, "core.js"), "export const core = 1\n");
      await writeFile(path.join(dir, "coverage.gcno"), "notes");
      const report = await scan(dir);
      const rules = report.findings.map((row) => `${row.rule}:${row.path}`);
      expect(rules).toEqual(
        expect.arrayContaining([
          "CRASH-001:core",
          "CRASH-001:core.4412",
          "CRASH-001:app.dmp",
          "CRASH-001:anonymous.bin",
          "DBG-001:coverage.gcno",
        ]),
      );
      expect(rules.some((row) => row === "CRASH-001:libfoo.so")).toBe(false);
      expect(rules.some((row) => row.startsWith("CRASH-001:core.js"))).toBe(false);
      expect(report.findings.find((row) => row.rule === "CRASH-001")?.severity).toBe("critical");
      expect(report.ok).toBe(false);
      expect(report.status).toBe("failed-policy");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
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

  it("warns when a packed file blows past the size baseline", async () => {
    await withDir({ "blob.bin": "x".repeat(FILE_WARN_BYTES) }, async (dir) => {
      const report = await scan(dir);
      expect(report.ok).toBe(true);
      expect(report.findings.some((f) => f.rule === "SIZE-001")).toBe(true);
    });
  });

  it("flags backups, dumps, nested packs, internal docs, and escaping symlinks", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ns-extra-"));
    try {
      await writeFile(path.join(dir, "app.js.bak"), "old");
      await writeFile(path.join(dir, "prod.sql"), "SELECT 1");
      await writeFile(path.join(dir, "nested.tgz"), "not-a-real-tarball");
      await writeFile(path.join(dir, "ROADMAP.md"), "secret plan");
      await symlink("/etc/passwd", path.join(dir, "escape"));
      const report = await scan(dir);
      const rules = report.findings.map((row) => row.rule);
      expect(rules).toEqual(
        expect.arrayContaining(["BAK-001", "DB-001", "ARC-001", "DOC-001", "LNK-001"]),
      );
      expect(report.findings.find((row) => row.rule === "DB-001")?.severity).toBe("critical");
      expect(report.findings.find((row) => row.rule === "LNK-001")?.severity).toBe("critical");
      expect(report.ok).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("unpacks nested tarballs and flags spoilers inside them without executing", async () => {
    const inner = await mkdtemp(path.join(os.tmpdir(), "ns-nest-in-"));
    const outer = await mkdtemp(path.join(os.tmpdir(), "ns-nest-out-"));
    try {
      await writeFile(path.join(inner, ".env"), "SECRET=1\n");
      await tarCreate({ gzip: true, file: path.join(outer, "payload.tgz"), cwd: inner }, ["."]);
      const report = await scan(outer);
      expect(report.findings.some((row) => row.rule === "ARC-001" && row.path.endsWith("payload.tgz"))).toBe(
        true,
      );
      const env = report.findings.find((row) => row.rule === "SEC-001");
      expect(env?.path).toMatch(/payload\.tgz!.*\.env/);
      expect(report.ok).toBe(false);
      expect(report.status).toBe("failed-policy");
    } finally {
      await rm(inner, { recursive: true, force: true });
      await rm(outer, { recursive: true, force: true });
    }
  });

  it("marks archive safety limits as inconclusive, never clean", async () => {
    await withDir({ "a.js": "12345", "b.js": "67890" }, async (dir) => {
      const tooMany = await scan(dir, { maxFiles: 1 });
      expect(tooMany.ok).toBe(false);
      expect(tooMany.status).toBe("inconclusive");
      expect(tooMany.inconclusiveReason).toMatch(/more than 1 files/);

      const perFile = await scan(dir, { maxFileBytes: 4 });
      expect(perFile.status).toBe("inconclusive");
      expect(perFile.inconclusiveReason).toMatch(/per-file limit/);

      const unpacked = await scan(dir, { maxUnpackedBytes: 8 });
      expect(unpacked.status).toBe("inconclusive");
      expect(unpacked.inconclusiveReason).toMatch(/unpacked limit/);
    });
  });

  it("marks a ZIP that exceeds the unpacked budget as inconclusive", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("payload.txt", "x".repeat(100_000));
    const target = path.join(os.tmpdir(), `ns-limit-${Date.now()}.zip`);
    try {
      await writeFile(target, await zip.generateAsync({ type: "nodebuffer" }));
      const report = await scan(target, { maxUnpackedBytes: 10_000 });
      expect(report.ok).toBe(false);
      expect(report.status).toBe("inconclusive");
      expect(report.inconclusiveReason).toMatch(/unpacked limit/);
      expect(report.artifactSha256).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      await rm(target, { force: true });
    }
  });
});
