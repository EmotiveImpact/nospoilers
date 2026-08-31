import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nospoilersApi } from "./src/plugin.ts";

export default defineConfig({
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
  },
  preview: {
    host: true,
    port: 4347,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
