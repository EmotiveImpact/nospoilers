import { matchPathGlob } from "../policy.ts";
import type { WorkspaceDiscovery, WorkspaceKind, WorkspaceMember } from "./types.ts";

export type { WorkspaceDiscovery, WorkspaceKind, WorkspaceMember } from "./types.ts";

export const MAX_WORKSPACE_ROOTS = 25;
export const MAX_WORKSPACE_MEMBERS = 200;
export const MAX_WORKSPACE_FILE_BYTES = 256_000;

export type WorkspaceFile = {
  path: string;
  text: string;
};

function posixPath(rel: string): string {
  return rel.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/\.\//g, "/");
}

function posixBasename(rel: string): string {
  const value = posixPath(rel).replace(/!\//g, "/");
  const slash = value.lastIndexOf("/");
  return slash >= 0 ? value.slice(slash + 1) : value;
}

function posixDirname(rel: string): string {
  const value = posixPath(rel);
  const slash = value.lastIndexOf("/");
  return slash >= 0 ? value.slice(0, slash) : "";
}

function ignoredPath(rel: string): boolean {
  return posixPath(rel)
    .replace(/!\//g, "/")
    .split("/")
    .some((seg) => seg === "node_modules" || seg === ".git" || seg === ".yarn" || seg === ".pnpm");
}

export function isWorkspaceConfigName(filePath: string): boolean {
  const base = posixBasename(filePath);
  return (
    base === "package.json" ||
    base === "pnpm-workspace.yaml" ||
    base === "pnpm-workspace.yml" ||
    base === "yarn.lock" ||
    base === "bun.lock" ||
    base === "bun.lockb"
  );
}

export function workspaceFileFrom(rel: string, buf: Buffer): WorkspaceFile | null {
  if (!isWorkspaceConfigName(rel) || ignoredPath(rel)) return null;
  const base = posixBasename(rel);
  if (base === "yarn.lock" || base === "bun.lock" || base === "bun.lockb") {
    return { path: posixPath(rel), text: "" };
  }
  if (buf.length > MAX_WORKSPACE_FILE_BYTES) return null;
  return { path: posixPath(rel), text: buf.toString("utf8") };
}

function unquote(raw: string): string {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function expandBraces(pattern: string): string[] {
  const match = /\{([^{}]+)\}/.exec(pattern);
  if (!match || match.index === undefined) return [pattern];
  const out: string[] = [];
  for (const part of match[1].split(",")) {
    const next = `${pattern.slice(0, match.index)}${part}${pattern.slice(match.index + match[0].length)}`;
    out.push(...expandBraces(next));
  }
  return out.length > 0 ? out : [pattern];
}

export function workspaceGlobsFromManifests(
  packageJsonText: string,
  pnpmWorkspaceText?: string | null,
): string[] {
  const pkg = parseJsonObject(packageJsonText);
  const fromPkg = pkg ? workspaceGlobsFromPkg(pkg) : [];
  const fromPnpm = pnpmWorkspaceText ? parsePnpmWorkspacePackages(pnpmWorkspaceText) : [];
  return [...fromPkg, ...fromPnpm].map((glob) => glob.trim()).filter(Boolean);
}

export function parsePnpmWorkspacePackages(text: string): string[] {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { packages?: unknown };
      if (Array.isArray(parsed.packages)) {
        return parsed.packages.filter((row): row is string => typeof row === "string").map((row) => row.trim());
      }
    } catch {
      return [];
    }
  }
  const packages: string[] = [];
  let inPackages = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "");
    if (!inPackages) {
      if (/^packages:\s*$/.test(line.trim())) {
        inPackages = true;
        continue;
      }
      const inline = line.trim().match(/^packages:\s*(\[.*\])\s*$/);
      if (inline?.[1]) {
        try {
          const arr = JSON.parse(inline[1].replace(/'/g, '"')) as unknown;
          if (Array.isArray(arr)) {
            return arr.filter((row): row is string => typeof row === "string").map((row) => row.trim());
          }
        } catch {
          return [];
        }
      }
      continue;
    }
    if (/^\S/.test(rawLine) && !line.trim().startsWith("-")) break;
    const item = line.trim().match(/^-\s*(.+)$/);
    if (item?.[1]) packages.push(unquote(item[1]));
  }
  return packages.filter(Boolean);
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text.replace(/^\uFEFF/, "")) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

export function workspaceGlobsFromPkg(pkg: Record<string, unknown>): string[] {
  const workspaces = pkg.workspaces;
  if (Array.isArray(workspaces)) {
    return workspaces.filter((row): row is string => typeof row === "string").map((row) => row.trim());
  }
  if (workspaces && typeof workspaces === "object") {
    const packages = (workspaces as { packages?: unknown }).packages;
    if (Array.isArray(packages)) {
      return packages.filter((row): row is string => typeof row === "string").map((row) => row.trim());
    }
  }
  return [];
}

function kindFor(
  pkg: Record<string, unknown>,
  names: Set<string>,
  pnpmYaml: boolean,
): WorkspaceKind {
  if (pnpmYaml) return "pnpm";
  const manager = typeof pkg.packageManager === "string" ? pkg.packageManager.toLowerCase() : "";
  if (manager.startsWith("pnpm")) return "pnpm";
  if (manager.startsWith("bun") || names.has("bun.lock") || names.has("bun.lockb")) return "bun";
  if (manager.startsWith("yarn") || names.has("yarn.lock")) return "yarn";
  return "npm";
}

function relToRoot(rootDir: string, absDir: string): string {
  if (!rootDir) return absDir;
  if (absDir === rootDir) return ".";
  const prefix = rootDir.endsWith("/") ? rootDir : `${rootDir}/`;
  if (absDir.startsWith(prefix)) return absDir.slice(prefix.length);
  return absDir;
}

function matchesGlobs(dirRel: string, globs: string[]): boolean {
  const includes = globs.filter((glob) => !glob.startsWith("!"));
  const excludes = globs.filter((glob) => glob.startsWith("!"));
  const included = includes.some((glob) =>
    expandBraces(glob).some((pattern) => matchPathGlob(pattern, dirRel)),
  );
  if (!included) return false;
  const excluded = excludes.some((glob) =>
    expandBraces(glob.slice(1)).some((pattern) => matchPathGlob(pattern, dirRel)),
  );
  return !excluded;
}

export function discoverWorkspaces(files: WorkspaceFile[]): WorkspaceDiscovery[] {
  const byPath = new Map<string, WorkspaceFile>();
  for (const file of files) {
    const path = posixPath(file.path);
    if (!path || ignoredPath(path)) continue;
    byPath.set(path, { path, text: file.text });
  }

  const namesIn = (dir: string): Set<string> => {
    const names = new Set<string>();
    const prefix = dir ? `${dir}/` : "";
    for (const filePath of byPath.keys()) {
      if (posixDirname(filePath) === dir) names.add(posixBasename(filePath));
      if (!dir && !filePath.includes("/") && !filePath.includes("!/")) names.add(posixBasename(filePath));
      if (prefix && filePath.startsWith(prefix) && posixDirname(filePath) === dir) {
        names.add(posixBasename(filePath));
      }
    }
    return names;
  };

  const packageJsonPaths = [...byPath.keys()].filter((filePath) => posixBasename(filePath) === "package.json");
  const discoveries: WorkspaceDiscovery[] = [];

  for (const packageJsonPath of packageJsonPaths) {
    if (discoveries.length >= MAX_WORKSPACE_ROOTS) break;
    const root = posixDirname(packageJsonPath);
    const pkg = parseJsonObject(byPath.get(packageJsonPath)?.text ?? "");
    if (!pkg) continue;
    const yamlPath = root ? `${root}/pnpm-workspace.yaml` : "pnpm-workspace.yaml";
    const ymlPath = root ? `${root}/pnpm-workspace.yml` : "pnpm-workspace.yml";
    const yaml = byPath.get(yamlPath) ?? byPath.get(ymlPath);
    const globs = [
      ...workspaceGlobsFromPkg(pkg),
      ...(yaml ? parsePnpmWorkspacePackages(yaml.text) : []),
    ].filter(Boolean);
    if (globs.length === 0) continue;

    const names = namesIn(root);
    const kind = kindFor(pkg, names, Boolean(yaml));
    const members: WorkspaceMember[] = [];
    for (const memberJsonPath of packageJsonPaths) {
      if (members.length >= MAX_WORKSPACE_MEMBERS) break;
      if (memberJsonPath === packageJsonPath) continue;
      const memberDir = posixDirname(memberJsonPath);
      const rel = relToRoot(root, memberDir);
      if (rel === "." || rel.startsWith("..")) continue;
      if (ignoredPath(rel) || ignoredPath(memberDir)) continue;
      if (memberDir.includes("!/") && !root.includes("!/") && !memberDir.startsWith(`${root}/`)) {
        continue;
      }
      if (root.includes("!/") && !memberDir.startsWith(`${root}/`) && memberDir !== root) continue;
      if (!matchesGlobs(rel, globs)) continue;
      const memberPkg = parseJsonObject(byPath.get(memberJsonPath)?.text ?? "");
      const name = typeof memberPkg?.name === "string" ? memberPkg.name.trim() : "";
      if (!name) continue;
      members.push({
        name,
        path: memberDir || ".",
        private: memberPkg?.private === true,
      });
    }
    members.sort((left, right) => left.path.localeCompare(right.path) || left.name.localeCompare(right.name));
    discoveries.push({
      kind,
      root: root || ".",
      configPath: yaml ? yaml.path : packageJsonPath,
      globs: [...new Set(globs)],
      members,
    });
  }

  return discoveries;
}

export function summarizeWorkspaces(workspaces: WorkspaceDiscovery[] | undefined): string {
  if (!workspaces || workspaces.length === 0) return "";
  return workspaces
    .map((workspace) => {
      const publishable = workspace.members.filter((member) => !member.private).map((member) => member.name);
      const privateNames = workspace.members.filter((member) => member.private).map((member) => member.name);
      const bits = [`${workspace.kind} workspace at ${workspace.root}`];
      bits.push(
        `${workspace.members.length} package${workspace.members.length === 1 ? "" : "s"}`,
      );
      if (publishable.length > 0) bits.push(`publishable ${publishable.join(", ")}`);
      if (privateNames.length > 0) bits.push(`private ${privateNames.join(", ")}`);
      return `${bits.join(": ")}.`;
    })
    .join(" ");
}
