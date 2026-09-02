import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scan } from "../src/scanner/index.ts";
import {
  listThrowawayFiles,
  THROWAWAY_ASSET,
  THROWAWAY_FULL,
  writeDeniedMessage,
} from "../scripts/phase1-throwaway.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("throwaway fixture content", () => {
  it("packs the same hostile map as fixtures/sourcemap.tgz", async () => {
    const files = Object.fromEntries(
      (await listThrowawayFiles()).map((file) => [file.path, file.bytes.toString("utf8")]),
    );
    expect(Object.keys(files).sort()).toEqual(
      [
        ".env",
        ".github/workflows/phase1-fixture-release.yml",
        ".gitignore",
        "README.md",
        "pack/index.js",
        "pack/index.js.map",
        "pack/package.json",
      ].sort(),
    );
    const listing = execFileSync("tar", ["-tzf", path.join(root, "fixtures", THROWAWAY_ASSET)], {
      encoding: "utf8",
    });
    expect(listing).toMatch(/index\.js\.map/);
    expect(files["pack/package.json"]).toContain("spoiler-pack");
    expect(files["pack/index.js"]).toContain("sourceMappingURL=index.js.map");
    expect(files["pack/index.js.map"]).toContain("this-is-the-plot-twist");
    expect(files["pack/index.js.map"]).toBe(
      execFileSync("tar", ["-xOf", path.join(root, "fixtures", THROWAWAY_ASSET), "./index.js.map"], {
        encoding: "utf8",
      }),
    );
    expect(files[".env"]).toMatch(/NOSPOILERS_FIXTURE/);
    expect(files[".github/workflows/phase1-fixture-release.yml"]).toMatch(/contents: write/);
    expect(files[".github/workflows/phase1-fixture-release.yml"]).not.toMatch(/administration:/i);
    expect(files["README.md"]).toMatch(/safe to publicize/i);
    expect(files["README.md"]).toMatch(/Administration/);
  });

  it("fails policy on the throwaway pack directory", async () => {
    const report = await scan(path.join(root, "throwaway", "pack"));
    expect(report.ok).toBe(false);
    expect(report.status).toBe("failed-policy");
    expect(report.findings.map((row) => row.rule)).toEqual(
      expect.arrayContaining(["MAP-001", "MAP-002", "MAP-003"]),
    );
    expect(JSON.stringify(report)).not.toContain("this-is-the-plot-twist");
  });

  it("asks for Contents write, not Administration", () => {
    const message = writeDeniedMessage();
    expect(message).toContain(THROWAWAY_FULL);
    expect(message).toMatch(/Contents: write/);
    expect(message).toMatch(/Do not grant Administration/);
    expect(message).not.toMatch(/Administration \+ Contents write/);
  });
});
