import { mkdtemp, mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "vite";
import { expect, it, vi } from "vitest";
import { excludePrototypeGalleries } from "../vite.config.ts";

it("excludes complete design galleries from a real build while retaining source and homepage assets", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "nospoilers-packaging-"));
  const files = ["mockup-review/nested/index.html", "mockup-review/README.md", "mockups/index.html", "assets/homepage/hero.png"];
  try {
    await writeFile(path.join(root, "index.html"), "<html><body>Product</body></html>");
    for (const file of files) {
      const target = path.join(root, "public", file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file);
    }
    await build({ root, configFile: false, logLevel: "silent", plugins: [excludePrototypeGalleries()] });
    for (const directory of ["mockup-review", "mockups"]) {
      await expect(access(path.join(root, "dist", directory))).rejects.toMatchObject({ code: "ENOENT" });
    }
    for (const file of files) expect(await readFile(path.join(root, "public", file), "utf8")).toBe(file);
    expect(await readFile(path.join(root, "dist/assets/homepage/hero.png"), "utf8")).toBe("assets/homepage/hero.png");
    expect(await readFile(path.join(root, "dist/index.html"), "utf8")).toContain("Product");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


it("retains local review navigation but omits the dead gallery link in production", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { MockupsPage } = await import("../src/pages/MockupsPage.tsx");
  try {
    vi.stubEnv("DEV", true);
    expect(renderToStaticMarkup(<MockupsPage />)).toContain('/mockup-review/index.html');
    vi.stubEnv("DEV", false);
    const production = renderToStaticMarkup(<MockupsPage />);
    expect(production).not.toContain('/mockup-review/');
    expect(production).not.toContain('Review comps');
    expect(production).toContain('Open Watch');
    expect(production).toContain('Open Scan');
  } finally {
    vi.unstubAllEnvs();
  }
});
