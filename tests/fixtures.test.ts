import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scan, toSarif } from "../src/scanner/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = path.join(root, "fixtures");

function rules(target: string, report: Awaited<ReturnType<typeof scan>>): string[] {
  expect(report.target).toContain(path.basename(target));
  return report.findings.map((f) => f.rule);
}

describe("packed fixtures", () => {
  it("lets a clean npm tarball ship", async () => {
    const report = await scan(path.join(fixtures, "clean.tgz"));
    expect(report.kind).toBe("tarball");
    expect(report.ok).toBe(true);
    expect(report.status).toBe("passed");
    expect(report.artifactSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.artifactSha512).toMatch(/^[a-f0-9]{128}$/);
    expect(report.manifest.length).toBeGreaterThan(0);
    expect(report.findings).toEqual([]);
  });

  it("fails a tarball that contains a source map", async () => {
    const report = await scan(path.join(fixtures, "sourcemap.tgz"));
    expect(report.ok).toBe(false);
    expect(rules("sourcemap.tgz", report)).toEqual(
      expect.arrayContaining(["MAP-001", "MAP-002", "MAP-003"]),
    );
  });

  it("fails an Electron asar that contains a source map", async () => {
    const report = await scan(path.join(fixtures, "sourcemap.asar"));
    expect(report.kind).toBe("asar");
    expect(report.ok).toBe(false);
    expect(rules("sourcemap.asar", report)).toEqual(
      expect.arrayContaining(["MAP-001", "MAP-002", "MAP-003"]),
    );
  });

  it("fails a zip that contains a source map", async () => {
    const report = await scan(path.join(fixtures, "sourcemap.zip"));
    expect(report.kind).toBe("zip");
    expect(report.ok).toBe(false);
    expect(rules("sourcemap.zip", report)).toEqual(
      expect.arrayContaining(["MAP-001", "MAP-002", "MAP-003"]),
    );
  });

  it("fails a tarball that contains a .env", async () => {
    const report = await scan(path.join(fixtures, "dotenv.tgz"));
    expect(report.ok).toBe(false);
    expect(rules("dotenv.tgz", report)).toContain("SEC-001");
  });

  it("marks a tarball that exceeds the unpacked budget as inconclusive", async () => {
    const report = await scan(path.join(fixtures, "clean.tgz"), { maxUnpackedBytes: 1 });
    expect(report.ok).toBe(false);
    expect(report.status).toBe("inconclusive");
    expect(report.inconclusiveReason).toMatch(/unpacked limit/);
  });

  it("writes SARIF errors for a dirty pack", async () => {
    const report = await scan(path.join(fixtures, "sourcemap.tgz"));
    const sarif = toSarif(report) as {
      version: string;
      runs: { results: { ruleId: string; level: string }[] }[];
    };
    expect(sarif.version).toBe("2.1.0");
    const ids = sarif.runs[0]?.results.map((r) => r.ruleId) ?? [];
    expect(ids).toContain("MAP-001");
    expect(sarif.runs[0]?.results.every((r) => r.level === "error")).toBe(true);
  });
});

describe("cli exit codes", () => {
  function runScan(rel: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const tsx = path.join(root, "node_modules/tsx/dist/cli.mjs");
      const child = spawn(process.execPath, [tsx, path.join(root, "src/cli.ts"), "scan", path.join(fixtures, rel)], {
        cwd: root,
        stdio: "ignore",
      });
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 2));
    });
  }

  it("exits 0 on the clean tarball", async () => {
    expect(await runScan("clean.tgz")).toBe(0);
  });

  it("exits 1 on the source-map tarball", async () => {
    expect(await runScan("sourcemap.tgz")).toBe(1);
  });

  it("exits 1 on the source-map asar", async () => {
    expect(await runScan("sourcemap.asar")).toBe(1);
  });
});
