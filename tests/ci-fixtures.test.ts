import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { expectedFixtureExit, listFixturePacks } from "../scripts/ci-scan-fixtures.ts";

describe("product CI fixture gate", () => {
  it("classifies every committed fixture pack as pass or fail-closed", async () => {
    const packs = await listFixturePacks();
    expect(packs.length).toBeGreaterThan(10);
    expect(packs).toContain("clean.tgz");
    expect(packs).toContain("sourcemap.vsix");
    expect(packs).toContain("dotenv.tgz");
    expect(packs).toContain("workspace.tgz");
    expect(packs).toContain("inconclusive.encrypted.zip");
    expect(packs).toContain("inconclusive.crx");
    expect(packs).toContain("inconclusive.encrypted.oci.tar");
    expect(packs.some((name) => name === "web" || name.startsWith("web/"))).toBe(false);
    for (const name of packs) {
      expect(expectedFixtureExit(name), name).not.toBeNull();
    }
    expect(expectedFixtureExit("clean.gem")).toBe(0);
    expect(expectedFixtureExit("workspace.tgz")).toBe(0);
    expect(expectedFixtureExit("sourcemap.vsix")).toBe(1);
    expect(expectedFixtureExit("dotenv.tgz")).toBe(1);
    expect(expectedFixtureExit("inconclusive.encrypted.zip")).toBe(2);
    expect(expectedFixtureExit("inconclusive.crx")).toBe(2);
    expect(expectedFixtureExit("inconclusive.encrypted.oci.tar")).toBe(2);
    expect(expectedFixtureExit("mystery.bin")).toBeNull();
  });

  it("runs the fixture matrix from GitHub Actions after rebuild and dogfoods the Action", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(workflow).toMatch(/npm run fixtures/);
    expect(workflow).toMatch(/npm run ci:fixtures/);
    expect(workflow).toMatch(/uses: \.\//);
    expect(workflow).toMatch(/path: fixtures\/clean\.tgz/);
    expect(workflow).toMatch(/path: fixtures\/sourcemap\.tgz/);
    expect(workflow).toMatch(/scan fixtures\/clean\.tgz --sarif/);
  });
});
