import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = path.join(root, "fixtures");

export function expectedFixtureExit(name: string): 0 | 1 | 2 | null {
  if (name.startsWith("clean.") || name === "workspace.tgz") return 0;
  if (name.startsWith("sourcemap.") || name === "dotenv.tgz") return 1;
  if (name.startsWith("inconclusive.")) return 2;
  return null;
}

export async function listFixturePacks(): Promise<string[]> {
  const entries = await readdir(fixtures, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function runScan(name: string): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const tsx = path.join(root, "node_modules/tsx/dist/cli.mjs");
    const child = spawn(
      process.execPath,
      [tsx, path.join(root, "src/cli.ts"), "scan", path.join(fixtures, name)],
      { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
    );
    const chunks: Buffer[] = [];
    child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      resolve({ code: code ?? 2, output: Buffer.concat(chunks).toString("utf8") }),
    );
  });
}

export async function scanFixtureMatrix(): Promise<void> {
  const packs = await listFixturePacks();
  if (packs.length === 0) {
    throw new Error("No fixture packs under fixtures/.");
  }
  const unclassified = packs.filter((name) => expectedFixtureExit(name) === null);
  if (unclassified.length > 0) {
    throw new Error(
      `Unclassified fixture packs (add a clean.* / sourcemap.* / dotenv / workspace / inconclusive.* rule): ${unclassified.join(", ")}`,
    );
  }
  const failed: string[] = [];
  for (const name of packs) {
    const expected = expectedFixtureExit(name);
    if (expected === null) continue;
    const { code, output } = await runScan(name);
    process.stdout.write(`${name}: exit ${code} (expected ${expected})\n`);
    if (code !== expected) {
      failed.push(`${name}: exit ${code}, expected ${expected}\n${output.slice(0, 2000)}`);
    }
  }
  if (failed.length > 0) {
    throw new Error(`Fixture CI gate failed:\n${failed.join("\n")}`);
  }
}

async function main(): Promise<void> {
  await scanFixtureMatrix();
  process.stdout.write(
    "Fixture CI gate: every dirty pack failed closed; every inconclusive pack was not a passing receipt; every clean pack passed.\n",
  );
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
