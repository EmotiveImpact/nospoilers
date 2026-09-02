import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ScanReport } from "../scanner/index.ts";
import { workspaceGlobsFromManifests } from "../scanner/workspaces.ts";
import { isPackAssetName } from "./paths.ts";
import type { Store } from "./store.ts";

export const MAX_PROSPECT_WORKSPACE_PACKS = 8;
export const MAX_PROSPECT_WORKSPACE_NAMES = 40;

export const DEFAULT_PROSPECT_QUERY =
  "topic:electron fork:false archived:false stars:10..5000 pushed:>2026-01-01";

type PublicArtifact = {
  source: "github_release" | "npm";
  owner: string;
  repo: string;
  repositoryUrl: string;
  packageName?: string;
  releaseTag?: string;
  artifactName: string;
  artifactUrl: string;
  artifactBytes?: number;
};

type GithubRepo = {
  full_name: string;
  html_url: string;
  default_branch: string;
  archived: boolean;
};

type GithubRelease = {
  tag_name: string;
  assets: {
    name: string;
    size: number;
    browser_download_url: string;
  }[];
};

type GithubContent = {
  content?: string;
  encoding?: string;
};

function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "NoSpoilers-Artifact-Leads",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function githubJson<T>(
  pathname: string,
  token: string,
  options: { allow404?: boolean } = {},
): Promise<T | null> {
  const response = await fetch(`https://api.github.com${pathname}`, {
    headers: githubHeaders(token),
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 404 && options.allow404) return null;
  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const detail = remaining === "0" ? " GitHub API rate limit reached." : "";
    throw new Error(`GitHub API returned ${response.status}.${detail}`);
  }
  return (await response.json()) as T;
}

async function npmJson<T>(packageName: string): Promise<T | null> {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, {
    headers: { Accept: "application/json", "User-Agent": "NoSpoilers-Artifact-Leads" },
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`npm registry returned ${response.status}.`);
  return (await response.json()) as T;
}

export function workspaceParentDirs(globs: string[]): string[] {
  const dirs = new Set<string>();
  for (const raw of globs) {
    const glob = raw.trim();
    if (!glob || glob.startsWith("!")) continue;
    const cleaned = glob.replace(/\/+$/, "");
    if (!cleaned || cleaned.includes("..") || cleaned.includes("**")) continue;
    if (cleaned.endsWith("/*") && !cleaned.slice(0, -2).includes("*")) {
      const parent = cleaned.slice(0, -2);
      if (parent) dirs.add(parent);
      continue;
    }
    if (!cleaned.includes("*")) dirs.add(cleaned);
  }
  return [...dirs].sort().slice(0, MAX_PROSPECT_WORKSPACE_PACKS);
}

export function workspaceMemberNamesFromReport(
  workspaces: ScanReport["workspaces"],
  cap = MAX_PROSPECT_WORKSPACE_NAMES,
): string[] {
  const names = new Set<string>();
  for (const workspace of workspaces ?? []) {
    for (const member of workspace.members ?? []) {
      const name = typeof member.name === "string" ? member.name.trim() : "";
      if (name) names.add(name);
      if (names.size >= cap) return [...names].sort();
    }
  }
  return [...names].sort();
}

export async function nestedNpmArtifactsFromGithub(input: {
  owner: string;
  repo: string;
  repositoryUrl: string;
  rootPackageName?: string | null;
  readFile: (filePath: string) => Promise<string | null>;
  listDir: (dirPath: string) => Promise<Array<{ name: string; type: string }>>;
  npmLatest: (packageName: string) => Promise<{ version: string; tarball: string } | null>;
}): Promise<PublicArtifact[]> {
  const rootJson = await input.readFile("package.json");
  if (!rootJson) return [];
  const pnpm =
    (await input.readFile("pnpm-workspace.yaml")) ?? (await input.readFile("pnpm-workspace.yml"));
  const globs = workspaceGlobsFromManifests(rootJson, pnpm);
  const parents = workspaceParentDirs(globs);
  const artifacts: PublicArtifact[] = [];
  const seen = new Set<string>();
  const rootName = input.rootPackageName?.trim();
  if (rootName) seen.add(rootName);

  for (const parent of parents) {
    if (artifacts.length >= MAX_PROSPECT_WORKSPACE_PACKS) break;
    const exact = globs.some((glob) => glob.replace(/\/+$/, "") === parent && !glob.includes("*"));
    const dirs = exact
      ? [parent]
      : (await input.listDir(parent))
          .filter((row) => row.type === "dir" && row.name && !row.name.includes(".."))
          .map((row) => `${parent}/${row.name}`);
    for (const dir of dirs) {
      if (artifacts.length >= MAX_PROSPECT_WORKSPACE_PACKS) break;
      if (dir.includes("..")) continue;
      const memberJson = await input.readFile(`${dir}/package.json`);
      if (!memberJson) continue;
      let manifest: { name?: unknown; private?: unknown };
      try {
        manifest = JSON.parse(memberJson) as { name?: unknown; private?: unknown };
      } catch {
        continue;
      }
      if (manifest.private === true || typeof manifest.name !== "string") continue;
      const packageName = manifest.name.trim();
      if (!packageName || seen.has(packageName)) continue;
      const latest = await input.npmLatest(packageName);
      if (!latest) continue;
      seen.add(packageName);
      artifacts.push({
        source: "npm",
        owner: input.owner,
        repo: input.repo,
        repositoryUrl: input.repositoryUrl,
        packageName,
        releaseTag: latest.version,
        artifactName: `${packageName.replace(/[^A-Za-z0-9_.-]+/g, "-")}-${latest.version}.tgz`,
        artifactUrl: latest.tarball,
      });
    }
  }
  return artifacts;
}

function githubContentsPath(filePath: string): string {
  return filePath
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function parseGithubRepository(value: string): { owner: string; repo: string } | null {
  const trimmed = value.trim();
  let pair = trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
    pair = url.pathname.replace(/^\/|\/$/g, "");
  } catch {
    // owner/repo shorthand
  }
  const [owner, rawRepo, ...rest] = pair.split("/");
  const repo = rawRepo?.replace(/\.git$/i, "");
  if (
    rest.length > 0 ||
    !owner ||
    !repo ||
    !/^[A-Za-z0-9_.-]+$/.test(owner) ||
    !/^[A-Za-z0-9_.-]+$/.test(repo)
  ) {
    return null;
  }
  return { owner, repo };
}

async function packageArtifact(
  repo: GithubRepo,
  owner: string,
  name: string,
  token: string,
): Promise<PublicArtifact | null> {
  const content = await githubJson<GithubContent>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/contents/package.json?ref=${encodeURIComponent(repo.default_branch)}`,
    token,
    { allow404: true },
  );
  if (!content?.content || content.encoding !== "base64") return null;

  let manifest: { name?: unknown; private?: unknown };
  try {
    manifest = JSON.parse(Buffer.from(content.content.replace(/\n/g, ""), "base64").toString("utf8")) as {
      name?: unknown;
      private?: unknown;
    };
  } catch {
    return null;
  }
  if (manifest.private === true || typeof manifest.name !== "string" || !manifest.name) return null;

  const metadata = await npmJson<{
    "dist-tags"?: { latest?: string };
    versions?: Record<
      string,
      { dist?: { tarball?: string; fileCount?: number; unpackedSize?: number } }
    >;
  }>(manifest.name);
  const version = metadata?.["dist-tags"]?.latest;
  const dist = version ? metadata?.versions?.[version]?.dist : null;
  if (!version || !dist?.tarball) return null;
  return {
    source: "npm",
    owner,
    repo: name,
    repositoryUrl: repo.html_url,
    packageName: manifest.name,
    releaseTag: version,
    artifactName: `${manifest.name.replace(/[^A-Za-z0-9_.-]+/g, "-")}-${version}.tgz`,
    artifactUrl: dist.tarball,
    artifactBytes: undefined,
  };
}

export async function inspectGithubRepository(
  value: string,
  token: string,
  maxAssetBytes = 80 * 1024 * 1024,
): Promise<PublicArtifact[]> {
  const parsed = parseGithubRepository(value);
  if (!parsed) throw new Error("Use owner/repo or a github.com/owner/repo URL.");
  const owner = encodeURIComponent(parsed.owner);
  const name = encodeURIComponent(parsed.repo);
  const repo = await githubJson<GithubRepo>(`/repos/${owner}/${name}`, token);
  if (!repo) return [];

  const artifacts: PublicArtifact[] = [];
  const release = await githubJson<GithubRelease>(`/repos/${owner}/${name}/releases/latest`, token, {
    allow404: true,
  });
  for (const asset of release?.assets ?? []) {
    if (!isPackAssetName(asset.name) || asset.size > maxAssetBytes) continue;
    artifacts.push({
      source: "github_release",
      owner: parsed.owner,
      repo: parsed.repo,
      repositoryUrl: repo.html_url,
      releaseTag: release?.tag_name,
      artifactName: asset.name,
      artifactUrl: asset.browser_download_url,
      artifactBytes: asset.size,
    });
  }

  const npm = await packageArtifact(repo, parsed.owner, parsed.repo, token);
  if (npm) artifacts.push(npm);
  const nested = await nestedNpmArtifactsFromGithub({
    owner: parsed.owner,
    repo: parsed.repo,
    repositoryUrl: repo.html_url,
    rootPackageName: npm?.packageName ?? null,
    readFile: async (filePath) => {
      const content = await githubJson<GithubContent | unknown[]>(
        `/repos/${owner}/${name}/contents/${githubContentsPath(filePath)}?ref=${encodeURIComponent(repo.default_branch)}`,
        token,
        { allow404: true },
      );
      if (!content || Array.isArray(content) || content.encoding !== "base64" || !content.content) {
        return null;
      }
      return Buffer.from(content.content.replace(/\n/g, ""), "base64").toString("utf8");
    },
    listDir: async (dirPath) => {
      const listing = await githubJson<Array<{ name?: string; type?: string }> | GithubContent>(
        `/repos/${owner}/${name}/contents/${githubContentsPath(dirPath)}?ref=${encodeURIComponent(repo.default_branch)}`,
        token,
        { allow404: true },
      );
      if (!Array.isArray(listing)) return [];
      return listing
        .map((row) => ({ name: row.name ?? "", type: row.type ?? "" }))
        .filter((row) => row.name);
    },
    npmLatest: async (packageName) => {
      const metadata = await npmJson<{
        "dist-tags"?: { latest?: string };
        versions?: Record<string, { dist?: { tarball?: string } }>;
      }>(packageName);
      const version = metadata?.["dist-tags"]?.latest;
      const tarball = version ? metadata?.versions?.[version]?.dist?.tarball : null;
      if (!version || !tarball) return null;
      return { version, tarball };
    },
  });
  artifacts.push(...nested);
  return artifacts;
}

async function registerArtifacts(
  store: Store,
  artifacts: PublicArtifact[],
): Promise<{ found: number; queued: number; existing: number }> {
  let queued = 0;
  let existing = 0;
  for (const artifact of artifacts) {
    const prospect = await store.upsertProspect(artifact);
    if (!prospect.inserted) {
      existing += 1;
      continue;
    }
    const key = createHash("sha256").update(artifact.artifactUrl).digest("hex");
    await store.enqueueJob({
      deliveryId: `prospect:${key}`,
      priority: "heavy",
      kind: "prospect_scan",
      payload: { prospectId: prospect.id },
    });
    queued += 1;
  }
  return { found: artifacts.length, queued, existing };
}

export async function inspectAndQueueRepository(
  store: Store,
  repository: string,
  token: string,
  maxAssetBytes: number,
): Promise<{ repositories: number; found: number; queued: number; existing: number; errors: string[] }> {
  const artifacts = await inspectGithubRepository(repository, token, maxAssetBytes);
  const result = await registerArtifacts(store, artifacts);
  return { repositories: 1, ...result, errors: [] };
}

export async function discoverAndQueueProspects(
  store: Store,
  input: { query?: string; limit?: number },
  token: string,
  maxAssetBytes: number,
): Promise<{
  repositories: number;
  found: number;
  queued: number;
  existing: number;
  errors: string[];
}> {
  const query = input.query?.trim() || DEFAULT_PROSPECT_QUERY;
  const limit = Math.min(20, Math.max(1, input.limit ?? 5));
  const result = await githubJson<{ items?: { full_name?: string }[] }>(
    `/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=${limit}`,
    token,
  );
  const repositories = (result?.items ?? [])
    .map((item) => item.full_name)
    .filter((name): name is string => Boolean(name));

  let found = 0;
  let queued = 0;
  let existing = 0;
  const errors: string[] = [];
  for (const repository of repositories) {
    try {
      const artifacts = await inspectGithubRepository(repository, token, maxAssetBytes);
      const registered = await registerArtifacts(store, artifacts);
      found += registered.found;
      queued += registered.queued;
      existing += registered.existing;
    } catch (error) {
      errors.push(
        `${repository}: ${error instanceof Error ? error.message : "Could not inspect repository."}`,
      );
    }
  }
  return { repositories: repositories.length, found, queued, existing, errors };
}

function allowedArtifactUrl(raw: string): URL {
  const url = new URL(raw);
  const hostname = url.hostname.toLowerCase();
  const allowed =
    url.protocol === "https:" &&
    (hostname === "github.com" ||
      hostname === "registry.npmjs.org" ||
      hostname === "objects.githubusercontent.com" ||
      hostname.endsWith(".githubusercontent.com"));
  if (!allowed) throw new Error("Artifact host is not on the public GitHub/npm allowlist.");
  return url;
}

async function downloadArtifact(url: string, maxBytes: number): Promise<Buffer> {
  allowedArtifactUrl(url);
  const response = await fetch(url, {
    headers: { "User-Agent": "NoSpoilers-Artifact-Leads" },
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Artifact download returned ${response.status}.`);
  }
  allowedArtifactUrl(response.url);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error(`Artifact is larger than ${maxBytes} bytes.`);

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Artifact is larger than ${maxBytes} bytes.`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export function hashArtifactBytes(bytes: Buffer | Uint8Array): { sha256: string; sha512: string } {
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sha512: createHash("sha512").update(bytes).digest("hex"),
  };
}

export async function scanProspectArtifact(
  prospectId: number,
  deps: {
    store: Store;
    scan: (target: string) => Promise<ScanReport>;
    maxAssetBytes: number;
    download?: (url: string, maxBytes: number) => Promise<Buffer>;
  },
): Promise<void> {
  const prospect = await deps.store.getProspect(prospectId);
  if (!prospect) throw new Error("Prospect no longer exists.");
  await deps.store.startProspectScan(prospect.id);
  const dir = await mkdtemp(path.join(os.tmpdir(), "nospoilers-prospect-"));
  const filename = prospect.artifact_name.replace(/[^A-Za-z0-9_.-]+/g, "_");
  const target = path.join(dir, filename || "artifact.bin");
  try {
    const bytes = await (deps.download ?? downloadArtifact)(prospect.artifact_url, deps.maxAssetBytes);
    const digests = hashArtifactBytes(bytes);
    await writeFile(target, bytes, { flag: "wx" });
    const report = await deps.scan(target);
    await deps.store.completeProspectScan(prospect.id, {
      fileCount: report.fileCount,
      findings: report.findings,
      workspaceMembers: workspaceMemberNamesFromReport(report.workspaces),
      artifactSha256: digests.sha256,
      artifactSha512: digests.sha512,
      artifactBytes: bytes.byteLength,
    });
  } catch (error) {
    await deps.store.failProspectScan(
      prospect.id,
      error instanceof Error ? error.message : "Prospect scan failed.",
    );
    throw error;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
