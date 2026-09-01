const LIFECYCLE_SCRIPTS = [
  "preinstall",
  "install",
  "postinstall",
  "prepare",
  "prepublish",
  "prepublishOnly",
] as const;

export type PackageIdentityFacts = {
  maintainers: string[];
  repositoryUrl: string | null;
  homepage: string | null;
  binNames: string[];
  lifecycleScripts: string[];
};

export type OwnershipProof = {
  via: "scope_match" | "github_repository";
  githubRepo: string | null;
};

export type IdentityChange =
  | { kind: "maintainers"; added: string[]; removed: string[] }
  | { kind: "repository"; from: string | null; to: string | null }
  | { kind: "homepage"; from: string | null; to: string | null }
  | { kind: "bin"; added: string[] }
  | { kind: "lifecycle"; added: string[] };

export const emptyPackageIdentity = (): PackageIdentityFacts => ({
  maintainers: [],
  repositoryUrl: null,
  homepage: null,
  binNames: [],
  lifecycleScripts: [],
});

export function normalizeMaintainerNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const names = new Set<string>();
  for (const entry of raw) {
    if (typeof entry === "string" && entry.trim()) {
      names.add(entry.trim().toLowerCase());
      continue;
    }
    if (entry && typeof entry === "object") {
      const name = (entry as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) names.add(name.trim().toLowerCase());
    }
  }
  return [...names].sort();
}

export function githubRepoFromNpmRepository(raw: string | null | undefined): {
  owner: string;
  name: string;
  fullName: string;
} | null {
  if (!raw || !raw.trim()) return null;
  let cleaned = raw.trim().replace(/^git\+/, "");
  if (cleaned.startsWith("git@github.com:")) {
    cleaned = `https://github.com/${cleaned.slice("git@github.com:".length)}`;
  }
  cleaned = cleaned.replace(/\.git$/i, "");
  let url: URL;
  try {
    url = new URL(cleaned.includes("://") ? cleaned : `https://${cleaned}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") return null;
  const parts = url.pathname.replace(/^\//, "").split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const name = parts[1].replace(/\.git$/i, "");
  if (!owner || !name) return null;
  return { owner, name, fullName: `${owner}/${name}` };
}

export function verifyPackageOwnership(input: {
  packageName: string;
  repositoryUrl: string | null;
  installationAccountLogin: string;
  installationRepos: { owner: string; name: string; full_name: string }[];
}): OwnershipProof | null {
  const login = input.installationAccountLogin.trim().toLowerCase();
  if (!login) return null;
  const packageName = input.packageName.trim().toLowerCase();
  if (packageName.startsWith(`@${login}/`)) {
    const repo = githubRepoFromNpmRepository(input.repositoryUrl);
    return { via: "scope_match", githubRepo: repo?.fullName ?? null };
  }
  const repo = githubRepoFromNpmRepository(input.repositoryUrl);
  if (!repo) return null;
  if (repo.owner.toLowerCase() === login) {
    return { via: "github_repository", githubRepo: repo.fullName };
  }
  const covered = input.installationRepos.some(
    (row) => row.full_name.toLowerCase() === repo.fullName.toLowerCase(),
  );
  if (!covered) return null;
  return { via: "github_repository", githubRepo: repo.fullName };
}

export function diffPackageIdentity(
  previous: PackageIdentityFacts | null,
  next: PackageIdentityFacts,
): IdentityChange[] {
  if (!previous) return [];
  const changes: IdentityChange[] = [];
  const prevMaintainers = new Set(previous.maintainers);
  const nextMaintainers = new Set(next.maintainers);
  const addedMaintainers = next.maintainers.filter((name) => !prevMaintainers.has(name));
  const removedMaintainers = previous.maintainers.filter((name) => !nextMaintainers.has(name));
  if (addedMaintainers.length > 0 || removedMaintainers.length > 0) {
    changes.push({ kind: "maintainers", added: addedMaintainers, removed: removedMaintainers });
  }
  if ((previous.repositoryUrl ?? "") !== (next.repositoryUrl ?? "")) {
    changes.push({ kind: "repository", from: previous.repositoryUrl, to: next.repositoryUrl });
  }
  if ((previous.homepage ?? "") !== (next.homepage ?? "")) {
    changes.push({ kind: "homepage", from: previous.homepage, to: next.homepage });
  }
  const prevBins = new Set(previous.binNames);
  const addedBins = next.binNames.filter((name) => !prevBins.has(name));
  if (addedBins.length > 0) {
    changes.push({ kind: "bin", added: addedBins });
  }
  const prevScripts = new Set(previous.lifecycleScripts);
  const addedScripts = next.lifecycleScripts.filter((name) => !prevScripts.has(name));
  if (addedScripts.length > 0) {
    changes.push({ kind: "lifecycle", added: addedScripts });
  }
  return changes;
}

export function identityChanged(previous: PackageIdentityFacts | null, next: PackageIdentityFacts): boolean {
  return diffPackageIdentity(previous, next).length > 0;
}

export function describeIdentityChange(packageName: string, change: IdentityChange): {
  kind: string;
  title: string;
  body: string;
} {
  if (change.kind === "maintainers") {
    const parts = [];
    if (change.added.length > 0) parts.push(`added ${change.added.join(", ")}`);
    if (change.removed.length > 0) parts.push(`removed ${change.removed.join(", ")}`);
    return {
      kind: "package_maintainer_changed",
      title: `Maintainer change on npm ${packageName}`,
      body: `${parts.join("; ")}. This is an ownership continuity fact, not a malware verdict.`,
    };
  }
  if (change.kind === "repository") {
    return {
      kind: "package_repository_mismatch",
      title: `Repository field changed on npm ${packageName}`,
      body: `npm repository was ${change.from ?? "(none)"} and is now ${change.to ?? "(none)"}. Confirm this matches the GitHub repo you intended. This is not a compromise claim.`,
    };
  }
  if (change.kind === "homepage") {
    return {
      kind: "package_homepage_mismatch",
      title: `Homepage changed on npm ${packageName}`,
      body: `npm homepage was ${change.from ?? "(none)"} and is now ${change.to ?? "(none)"}. This is a metadata change, not a malware verdict.`,
    };
  }
  if (change.kind === "bin") {
    return {
      kind: "package_shape_anomaly",
      title: `New executable entry on npm ${packageName}`,
      body: `bin added ${change.added.join(", ")}. The packed artifact was not executed. A new bin is not a malware verdict.`,
    };
  }
  return {
    kind: "package_shape_anomaly",
    title: `New install lifecycle script on npm ${packageName}`,
    body: `scripts added ${change.added.join(", ")}. The packed artifact was not executed. A new lifecycle script is not a malware verdict.`,
  };
}

export function binNamesFromManifest(bin: unknown): string[] {
  if (typeof bin === "string" && bin.trim()) return ["(default)"];
  if (!bin || typeof bin !== "object") return [];
  return Object.keys(bin as Record<string, unknown>)
    .map((key) => key.trim())
    .filter(Boolean)
    .sort();
}

export function lifecycleScriptsFromManifest(scripts: unknown): string[] {
  if (!scripts || typeof scripts !== "object") return [];
  const record = scripts as Record<string, unknown>;
  return LIFECYCLE_SCRIPTS.filter((name) => typeof record[name] === "string" && String(record[name]).trim());
}

export function asHttpsMetadataUrl(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (trimmed.length > 500) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
