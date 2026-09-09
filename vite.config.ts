import path from "node:path";
import { readdir, rm } from "node:fs/promises";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nospoilersApi } from "./src/plugin.ts";

// Review notes remain available to local designers, but are not release assets.
// Keep the linked HTML/CSS/image prototypes and the approved homepage intact.
function excludePrototypeNotes(): Plugin {
  let reviewOutput = "";
  return {
    name: "exclude-prototype-notes",
    apply: "build",
    configResolved(config) {
      reviewOutput = path.resolve(config.root, config.build.outDir, "mockup-review");
    },
    async closeBundle() {
      let entries: string[];
      try {
        entries = await readdir(reviewOutput, { recursive: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
      await Promise.all(entries.filter(entry => /\.md$/i.test(entry)).map(entry =>
        rm(path.join(reviewOutput, entry)),
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
    plugins: [react(), tailwindcss(), nospoilersApi(), excludePrototypeNotes()],
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
