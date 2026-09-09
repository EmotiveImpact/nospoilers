import path from "node:path";
import { rm } from "node:fs/promises";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nospoilersApi } from "./src/plugin.ts";

// Static design galleries remain available in local development, never release assets.
export function excludePrototypeGalleries(): Plugin {
  let outputRoot = "";
  return {
    name: "exclude-prototype-galleries",
    apply: "build",
    configResolved(config) {
      outputRoot = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await Promise.all(["mockup-review", "mockups"].map(directory =>
        rm(path.join(outputRoot, directory), { recursive: true, force: true }),
      ));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return {
    plugins: [react(), tailwindcss(), nospoilersApi(), excludePrototypeGalleries()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
    },
    server: {
      host: true,
      port: 4347,
      strictPort: true,
      allowedHosts: [".trycloudflare.com", "localhost"],
    },
    preview: {
      host: true,
      port: 4347,
      strictPort: true,
      allowedHosts: [".trycloudflare.com", "localhost"],
    },
    test: {
      environment: "node",
      include: ["tests/**/*.test.{ts,tsx}"],
      // Each integration file boots and migrates its own WASM database.
      // Bound parallel databases; keep a finite budget for migration-heavy tests.
      maxWorkers: 2,
      testTimeout: 30_000,
    },
  };
});
