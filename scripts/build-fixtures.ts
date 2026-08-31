import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as asar from "@electron/asar";
import { c as tarCreate } from "tar";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = path.join(root, "fixtures");

const originalSource = `export function billingSecret(): string {
  return "this-is-the-plot-twist";
}
`;

const minified = `export function billingSecret(){return"this-is-the-plot-twist"}
`;

const sourceMap = JSON.stringify({
  version: 3,
  file: "index.js",
  sources: ["src/billing.ts"],
  sourcesContent: [originalSource],
  names: ["billingSecret"],
  mappings: "AAAA",
});

async function writeTree(dir: string, files: Record<string, string>): Promise<void> {
  for (const [rel, contents] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, contents);
  }
}

async function packTar(srcDir: string, dest: string): Promise<void> {
  await tarCreate({ gzip: true, file: dest, cwd: srcDir }, ["."]);
}

async function main(): Promise<void> {
  await mkdir(fixtures, { recursive: true });

  const cleanDir = await mkdtemp(path.join(os.tmpdir(), "ns-clean-"));
  const dirtyDir = await mkdtemp(path.join(os.tmpdir(), "ns-dirty-"));
  const envDir = await mkdtemp(path.join(os.tmpdir(), "ns-env-"));
  const asarSrc = await mkdtemp(path.join(os.tmpdir(), "ns-asar-"));

  try {
    await writeTree(cleanDir, { "index.js": minified, "package.json": '{"name":"clean-pack"}' });
    await writeTree(dirtyDir, {
      "index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
      "index.js.map": sourceMap,
      "package.json": '{"name":"spoiler-pack"}',
    });
    await writeTree(envDir, {
      "index.js": minified,
      ".env": "STRIPE_SECRET_KEY=sk_live_example\n",
    });
    await writeTree(asarSrc, {
      "index.js": `${minified}//# sourceMappingURL=index.js.map\n`,
      "index.js.map": sourceMap,
    });

    await packTar(cleanDir, path.join(fixtures, "clean.tgz"));
    await packTar(dirtyDir, path.join(fixtures, "sourcemap.tgz"));
    await packTar(envDir, path.join(fixtures, "dotenv.tgz"));
    await asar.createPackage(asarSrc, path.join(fixtures, "sourcemap.asar"));
  } finally {
    await rm(cleanDir, { recursive: true, force: true });
    await rm(dirtyDir, { recursive: true, force: true });
    await rm(envDir, { recursive: true, force: true });
    await rm(asarSrc, { recursive: true, force: true });
  }

  process.stdout.write(`Wrote fixtures to ${fixtures}\n`);
}

await main();
