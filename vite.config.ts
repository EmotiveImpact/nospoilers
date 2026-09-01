import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nospoilersApi } from "./src/plugin.ts";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return {
    plugins: [react(), tailwindcss(), nospoilersApi()],
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
      include: ["tests/**/*.test.ts"],
    },
  };
});
