import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/server/vercel-entry.ts" },
  outDir: ".vercel-runtime",
  format: ["esm"],
  platform: "node",
  target: "node22",
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: false,
  bundle: true,
  external: ["pg", "@electric-sql/pglite"],
});
