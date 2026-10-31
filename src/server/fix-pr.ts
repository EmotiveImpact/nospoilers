/**
 * Fix pull requests for common, mechanical findings.
 *
 * The changes are deterministic and rule-based. No model writes code here: the AI
 * review explains, this module edits. Every change is small, reviewable and
 * reversible, and NoSpoilers never merges the pull request.
 *
 * Covered:
 * - public source maps (MAP-001/002/003 and anything rebuilt from a map);
 * - environment files that shipped (SEC-001);
 * - loose files that should not be in the package (backups, dumps, crash files,
 *   caches, raw TypeScript, internal docs, agent context, keys, credential files).
 */
import type { Finding } from "../scanner/types.ts";

export type FixKind = "source_maps" | "env_file" | "loose_files";
export type FixTarget = { kind: FixKind; rule: string; path: string };
export type FixChange = { path: string; action: "write" | "delete"; content?: string; reason: string };
export type FixPlan = { kinds: FixKind[]; targets: FixTarget[]; changes: FixChange[]; notes: string[]; unfixable: string[] };

export type RepoWriter = {
  defaultBranch: () => Promise<string>;
  readFile: (path: string, ref: string) => Promise<string | null>;
  createBranch: (name: string, fromBranch: string) => Promise<void>;
  writeFile: (path: string, content: string, branch: string, message: string) => Promise<void>;
  deleteFile: (path: string, branch: string, message: string) => Promise<void>;
  findOpenPull: (branch: string) => Promise<{ number: number; url: string } | null>;
  openPull: (input: { title: string; body: string; head: string; base: string }) => Promise<{ number: number; url: string }>;
};

const MAP_RULES = new Set(["MAP-001", "MAP-002", "MAP-003"]);
const LOOSE_RULES = new Set(["BAK-001", "DB-001", "CRASH-001", "DBG-001", "CACHE-001", "SRC-001", "AI-001", "DOC-001", "SEC-002", "SEC-003", "SEC-004", "GIT-001"]);
const CREDENTIAL_RULES = new Set(["SEC-001", "SEC-002", "SEC-003", "SEC-004"]);

/** Saved alert findings are JSON; keep only well-formed rows. */
export function asFindings(value: unknown): Finding[] {
  const list = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (row): row is Finding =>
      !!row && typeof row === "object" && typeof (row as Finding).rule === "string" && typeof (row as Finding).path === "string",
  );
}

export function fixBranch(alertId: number): string {
  return `nospoilers/fix-alert-${alertId}`;
}

/** Map an artefact path to the path inside the package. npm tarballs wrap everything in package/. */
export function packagePath(artifactPath: string): string | null {
  if (artifactPath.includes("!/") || artifactPath.includes("::")) return null;
  const clean = artifactPath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^package\//, "");
  if (!clean || clean.split("/").some((part) => part === ".." || part === "")) return null;
  return clean;
}

function isEnvName(base: string): boolean {
  return base === ".env" || base.startsWith(".env.");
}

function isExampleEnv(base: string): boolean {
  return /\.(?:example|sample|template|dist|defaults?)$/i.test(base);
}

export function fixTargets(findings: Finding[]): { targets: FixTarget[]; unfixable: string[] } {
  const targets: FixTarget[] = [];
  const unfixable = new Set<string>();
  const seen = new Set<string>();
  const push = (target: FixTarget) => {
    const key = `${target.kind}|${target.rule}|${target.path}`;
    if (!seen.has(key)) {
      seen.add(key);
      targets.push(target);
    }
  };
  for (const finding of findings) {
    if (MAP_RULES.has(finding.rule) || finding.path.includes("::")) {
      push({ kind: "source_maps", rule: "MAP", path: "*" });
      continue;
    }
    const repoPath = packagePath(finding.path);
    if (finding.rule === "SEC-001" && repoPath) {
      push({ kind: "env_file", rule: finding.rule, path: repoPath });
    } else if (LOOSE_RULES.has(finding.rule) && repoPath) {
      push({ kind: "loose_files", rule: finding.rule, path: finding.rule === "GIT-001" ? ".git" : repoPath });
    } else {
      unfixable.add(finding.rule);
    }
  }
  return { targets, unfixable: [...unfixable].sort() };
}

function exclusionPatterns(targets: FixTarget[]): string[] {
  const patterns: string[] = [];
  const add = (pattern: string) => {
    if (!patterns.includes(pattern)) patterns.push(pattern);
  };
  for (const target of targets) {
    if (target.kind === "source_maps") add("**/*.map");
    else if (target.kind === "env_file") {
      add("**/.env");
      add("**/.env.*");
    } else add(target.path);
  }
  return patterns;
}

function indentOf(json: string): string | number {
  const match = /\n([ \t]+)"/.exec(json);
  return match ? match[1] : 2;
}

function withLines(existing: string, lines: string[], header: string): string | null {
  const present = new Set(existing.split(/\r?\n/).map((line) => line.trim()));
  const missing = lines.filter((line) => !present.has(line));
  if (!missing.length) return null;
  const base = existing.length && !existing.endsWith("\n") ? `${existing}\n` : existing;
  return `${base}${base ? "\n" : ""}${header}\n${missing.join("\n")}\n`;
}

/** Narrow, exact-match edits only. Anything less certain stays in the PR description. */
function bundlerEdit(file: string, source: string): { content: string; reason: string } | null {
  if (/^vite\.config\.[cm]?[jt]s$/.test(file) && /\bsourcemap\s*:\s*true\b/.test(source)) {
    return {
      content: source.replace(/\bsourcemap(\s*):(\s*)true\b/, "sourcemap$1:$2'hidden'"),
      reason: "Vite still writes maps for your error tracker, but production files no longer point browsers at them.",
    };
  }
  if (/^next\.config\.[cm]?[jt]s$/.test(file) && /\bproductionBrowserSourceMaps\s*:\s*true\b/.test(source)) {
    return {
      content: source.replace(/\bproductionBrowserSourceMaps(\s*):(\s*)true\b/, "productionBrowserSourceMaps$1:$2false"),
      reason: "Next.js stops publishing browser source maps in production builds.",
    };
  }
  if (/^webpack\.(?:prod\.)?config\.[cm]?[jt]s$/.test(file) && /\bdevtool\s*:\s*(["'])source-map\1/.test(source)) {
    return {
      content: source.replace(/\bdevtool(\s*):(\s*)(["'])source-map\3/, "devtool$1:$2$3hidden-source-map$3"),
      reason: "webpack keeps generating maps for error tracking but drops the public sourceMappingURL comment.",
    };
  }
  return null;
}

const BUNDLER_FILES = [
  "vite.config.ts", "vite.config.js", "vite.config.mjs", "vite.config.mts",
  "next.config.js", "next.config.mjs", "next.config.ts",
  "webpack.config.js", "webpack.prod.config.js", "webpack.config.ts",
];

export async function planFixPr(findings: Finding[], read: (path: string) => Promise<string | null>): Promise<FixPlan> {
  const { targets, unfixable } = fixTargets(findings);
  const kinds = [...new Set(targets.map((target) => target.kind))];
  const changes: FixChange[] = [];
  const notes: string[] = [];
  if (!targets.length) return { kinds, targets, changes, notes, unfixable };

  const patterns = exclusionPatterns(targets);
  const pkgText = await read("package.json");
  let pkg: Record<string, unknown> | null = null;
  if (pkgText !== null) {
    try {
      const parsed = JSON.parse(pkgText) as unknown;
      pkg = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      notes.push("package.json could not be parsed, so packaging rules were not changed.");
    }
  }
  if (pkg && Array.isArray(pkg.files) && pkg.files.every((entry) => typeof entry === "string")) {
    // npm ignores .npmignore when "files" is set, so exclusions go into "files" as negations.
    const files = pkg.files as string[];
    const negations = patterns.map((pattern) => `!${pattern}`).filter((entry) => !files.includes(entry));
    if (negations.length) {
      const next = { ...pkg, files: [...files, ...negations] };
      changes.push({
        path: "package.json",
        action: "write",
        content: `${JSON.stringify(next, null, indentOf(pkgText ?? ""))}${pkgText?.endsWith("\n") ? "\n" : ""}`,
        reason: `Adds ${negations.join(", ")} to "files" so npm leaves these out of the published package.`,
      });
    }
  } else if (pkg) {
    const existing = await read(".npmignore");
    if (existing === null) {
      // Creating .npmignore makes npm stop reading .gitignore. Carry it over so nothing new ships.
      const gitignore = (await read(".gitignore")) ?? "";
      const seeded = gitignore ? `# Copied from .gitignore: npm stops reading .gitignore once .npmignore exists.\n${gitignore}` : "";
      changes.push({
        path: ".npmignore",
        action: "write",
        content: withLines(seeded, patterns, "# Added by NoSpoilers: keep these out of the published package.") ?? seeded,
        reason: "Creates .npmignore with your existing .gitignore rules plus the files NoSpoilers found in the package.",
      });
    } else {
      const content = withLines(existing, patterns, "# Added by NoSpoilers: keep these out of the published package.");
      if (content) changes.push({ path: ".npmignore", action: "write", content, reason: "Adds the files NoSpoilers found to .npmignore." });
    }
  } else {
    notes.push("No package.json at the repository root, so packaging rules were not changed. Exclude these paths in whatever builds the release asset.");
  }

  if (kinds.includes("source_maps")) {
    let edited = false;
    for (const file of BUNDLER_FILES) {
      const source = await read(file);
      if (source === null) continue;
      const edit = bundlerEdit(file, source);
      if (edit) {
        changes.push({ path: file, action: "write", content: edit.content, reason: edit.reason });
        edited = true;
      }
    }
    if (!edited) notes.push("No bundler setting was changed automatically. If your build emits maps on purpose for error tracking, upload them to the tracker and keep them out of the published output.");
  }

  if (kinds.includes("env_file")) {
    const gitignore = changes.find((change) => change.path === ".gitignore")?.content ?? (await read(".gitignore")) ?? "";
    const content = withLines(gitignore, [".env", ".env.*", "!.env.example"], "# Added by NoSpoilers: never commit environment files.");
    if (content) changes.push({ path: ".gitignore", action: "write", content, reason: "Stops environment files being committed again." });
    for (const target of targets.filter((row) => row.kind === "env_file")) {
      const base = target.path.split("/").pop() ?? "";
      if (!isEnvName(base) || isExampleEnv(base)) continue;
      if ((await read(target.path)) !== null) {
        changes.push({ path: target.path, action: "delete", reason: "Removes the committed environment file. Its history stays in git, so rotate every value it held." });
      }
    }
  }

  if (targets.some((target) => CREDENTIAL_RULES.has(target.rule))) {
    notes.push("Credentials were public. Rotate every affected key, token and password now. Removing a file does not revoke what has already been downloaded.");
  }
  return { kinds, targets, changes, notes, unfixable };
}

const KIND_LABEL: Record<FixKind, string> = {
  source_maps: "public source maps",
  env_file: "shipped environment files",
  loose_files: "files that should not be in the package",
};

export function fixPullRequestTitle(plan: FixPlan): string {
  return `Fix ${plan.kinds.map((kind) => KIND_LABEL[kind]).join(", ")} found by NoSpoilers`;
}

export function fixPullRequestBody(plan: FixPlan, context: { alertTitle: string }): string {
  const lines = [
    `NoSpoilers opened this pull request for the alert "${context.alertTitle.slice(0, 160)}". It is **never merged automatically**.`,
    "",
    "## Changes",
    "",
    ...plan.changes.map((change) => `- \`${change.path}\` (${change.action === "delete" ? "deleted" : "updated"}): ${change.reason}`),
    "",
  ];
  if (plan.notes.length) lines.push("## Before you merge", "", ...plan.notes.map((note) => `- ${note}`), "");
  if (plan.unfixable.length) lines.push(`Not covered by this pull request: ${plan.unfixable.join(", ")}. See the alert for guidance.`, "");
  lines.push(
    "## How this gets verified",
    "",
    "1. Run `npm pack --dry-run` (or your release build) and check the files above are gone.",
    "2. Publish the next release as usual.",
    "3. NoSpoilers scans it. If none of these findings come back, the alert is marked **verified closed**.",
  );
  return lines.join("\n");
}

export type FixPrResult =
  | { ok: true; number: number; url: string; existing: boolean; plan: FixPlan }
  | { ok: false; reason: string; plan: FixPlan };

export async function openFixPullRequest(writer: RepoWriter, alert: { id: number; title: string; findings: Finding[] }): Promise<FixPrResult> {
  const base = await writer.defaultBranch();
  const plan = await planFixPr(alert.findings, (path) => writer.readFile(path, base));
  if (!plan.changes.length) {
    return { ok: false, reason: "There is no automatic fix for these findings in this repository. Use the fix guidance instead.", plan };
  }
  const branch = fixBranch(alert.id);
  const existing = await writer.findOpenPull(branch);
  if (existing) return { ok: true, number: existing.number, url: existing.url, existing: true, plan };
  await writer.createBranch(branch, base);
  const message = `NoSpoilers: fix alert ${alert.id}`;
  for (const change of plan.changes) {
    if (change.action === "delete") await writer.deleteFile(change.path, branch, message);
    else await writer.writeFile(change.path, change.content ?? "", branch, message);
  }
  const pull = await writer.openPull({ title: fixPullRequestTitle(plan), body: fixPullRequestBody(plan, { alertTitle: alert.title }), head: branch, base });
  return { ok: true, number: pull.number, url: pull.url, existing: false, plan };
}

/** True when a new scan still shows a problem this fix targeted. */
export function fixStillPresent(targets: FixTarget[], findings: Finding[]): boolean {
  const fresh = fixTargets(findings).targets;
  return targets.some((target) =>
    fresh.some((row) => row.kind === target.kind && (target.kind === "source_maps" || (row.rule === target.rule && row.path === target.path))),
  );
}
