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
      crons?: Array<{ path: string; schedule: string }>;
      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };

    const everyPage = config.headers.find((rule) => rule.source === "/(.*)")?.headers ?? [];
    expect(everyPage).toEqual(expect.arrayContaining([
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "X-Content-Type-Options", value: "nosniff" },
    ]));
    // Only hashed top-level build output is immutable; public/assets subfolders stay revalidated.
    const immutable = config.headers.find((rule) => rule.headers.some((h) => h.value.includes("immutable")));
    expect(immutable?.source).toBe("/assets/:file([^/]+\\.(?:js|css|woff2))");

    expect(config.rewrites).toEqual([
      { source: "/api/:path*", destination: "/api" },
      // Missing build chunks and API paths must 404, not return the HTML shell.
      { source: "/((?!api/|assets/).*)", destination: "/index.html" },
    ]);
    const fallback = new RegExp(`^${config.rewrites[1]!.source}$`);
    expect(fallback.test("/watch/alerts")).toBe(true);
    expect(fallback.test("/assets/index-stale123.js")).toBe(false);
    expect(fallback.test("/api/health")).toBe(false);
    expect(config.functions["api/index.mjs"]).toMatchObject({
      includeFiles: "{.vercel-runtime/**,src/server/schema.sql}",
      maxDuration: 300,
    });
    expect(await readFile("api/index.mjs", "utf8")).toContain("../.vercel-runtime/index.js");
    // The persistent Railway worker owns recovery and visibility polling.
    // Declaring a duplicate Vercel cron also blocks Hobby deployments.
    expect(config.crons).toBeUndefined();
  });

  it("keeps processing queued jobs after the HTTP response via waitUntil", async () => {
    const app = new Hono();
    app.get("/api/health", (c) => c.json({ ok: true }));
    let flushed = false;
    const handler = createVercelHandler(async () => ({
      app,
      flushJobs: async () => {
        flushed = true;
      },
    }));
    const pending: Promise<unknown>[] = [];

    const response = await handler(new Request("https://nospoilers.vercel.app/api/health"), {
      waitUntil(work) {
        pending.push(work);
      },
    });

    expect(response.status).toBe(200);
    expect(pending).toHaveLength(1);
    await pending[0];
    expect(flushed).toBe(true);
  });

  it("registers background work with Vercel's supported waitUntil API", async () => {
    const entry = await readFile("src/server/vercel-entry.ts", "utf8");
    expect(entry).toContain('from "@vercel/functions"');
    expect(entry).toContain("handler(request, { waitUntil })");
  });
});
