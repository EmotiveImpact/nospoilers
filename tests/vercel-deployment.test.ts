import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createVercelHandler } from "../src/server/vercel.ts";

describe("Vercel web runtime", () => {
  it("forwards the original API request to the Hono app", async () => {
    const app = new Hono();
    app.get("/api/health", (c) => c.json({ ok: true, role: "web" }));
    const handler = createVercelHandler(async () => ({ app }));

    const response = await handler(new Request("https://nospoilers.vercel.app/api/health"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, role: "web" });
  });

  it("fails closed without exposing runtime errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handler = createVercelHandler(async () => {
      throw new Error("secret database detail");
    });

    try {
      const response = await handler(new Request("https://nospoilers.vercel.app/api/health"));
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain("secret database detail");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("routes API traffic before the Vite SPA fallback", async () => {
    const config = JSON.parse(await readFile("vercel.json", "utf8")) as {
      rewrites: Array<{ source: string; destination: string }>;
      functions: Record<string, { includeFiles?: string; maxDuration?: number }>;
    };

    expect(config.rewrites).toEqual([
      { source: "/api/:path*", destination: "/api" },
      { source: "/:path*", destination: "/index.html" },
    ]);
    expect(config.functions["api/index.js"]).toMatchObject({
      includeFiles: "src/server/schema.sql",
      maxDuration: 300,
    });
  });
});
