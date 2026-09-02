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
    expect(packs.some((name) => name === "web" || name.startsWith("web/"))).toBe(false);
    for (const name of packs) {
      expect(expectedFixtureExit(name), name).not.toBeNull();
    }
    expect(expectedFixtureExit("clean.gem")).toBe(0);
    expect(expectedFixtureExit("workspace.tgz")).toBe(0);
    expect(expectedFixtureExit("sourcemap.vsix")).toBe(1);
    expect(expectedFixtureExit("dotenv.tgz")).toBe(1);
    expect(expectedFixtureExit("mystery.bin")).toBeNull();
  });

  it("runs the fixture matrix from GitHub Actions after rebuild", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(workflow).toMatch(/npm run fixtures/);
    expect(workflow).toMatch(/npm run ci:fixtures/);
    expect(workflow).toMatch(/scan fixtures\/clean\.tgz --sarif/);
  });
});
