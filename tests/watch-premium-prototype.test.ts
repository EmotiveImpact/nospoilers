import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("../public/mockups/", import.meta.url);

describe("premium Watch prototype safety", () => {
  it("keeps the prototype isolated from the live Watch application", async () => {
    const html = await readFile(new URL("watch-premium.html", root), "utf8");
    expect(html).toContain("Premium Watch prototype");
    expect(html).toContain("/mockups/watch-premium.js");
    expect(html).not.toContain('href="/watch"');
  });

  it("uses GET-only authenticated same-origin requests", async () => {
    const script = await readFile(new URL("watch-premium.js", root), "utf8");
    expect(script).toContain('method: "GET"');
    expect(script).toContain('credentials: "include"');
    expect(script).not.toMatch(/\b(?:POST|PUT|PATCH|DELETE)\b/);
    expect(script).not.toMatch(/fetch\(\s*["'`]https?:/);
  });

  it("contains no entity examples from the older design studies", async () => {
    const files = await Promise.all(
      ["watch-premium.html", "watch-premium.css", "watch-premium.js"].map((file) =>
        readFile(new URL(file, root), "utf8"),
      ),
    );
    const source = files.join("\n");
    for (const invented of ["acme-ui", "relay-worker", "@dana", "@ryan", "EmotiveImpact/desk"]) {
      expect(source).not.toContain(invented);
    }
  });
});
