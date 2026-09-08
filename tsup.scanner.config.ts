import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server/scanner-child.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist-parser',
  outExtension: () => ({ js: '.mjs' }),
  banner: { js: "import { createRequire as parserCreateRequire } from 'node:module'; const require = parserCreateRequire(import.meta.url);" },
  noExternal: [/.*/],
});
