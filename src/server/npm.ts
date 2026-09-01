import {
  parseRegistryOrigin,
  PUBLIC_NPM_HOST,
  PUBLIC_NPM_ORIGIN,
  registryMetadataUrl,
} from "./npm-registry.ts";
import {
  asHttpsMetadataUrl,
  binNamesFromManifest,
  lifecycleScriptsFromManifest,
  normalizeMaintainerNames,
  type PackageIdentityFacts,
} from "./package-identity.ts";

export type NpmDistTags = Record<string, string>;

export type NpmAuth = {
  registryOrigin: string;
  token?: string;
};

export const WATCHED_DIST_TAGS = ["next", "beta", "canary", "rc", "alpha", "preview"] as const;
export const MAX_CHANNEL_SCANS = 3;

export type NpmChannelTarball = {
  tag: (typeof WATCHED_DIST_TAGS)[number];
  version: string;
  tarballUrl: string;
  shasum: string | null;
};

export type NpmPack = {
  name: string;
  version: string;
  distTags: NpmDistTags;
  tarballUrl: string;
  shasum: string | null;
  integrity: string | null;
  bytes: number | null;
  identity: PackageIdentityFacts;
  publishedAt?: Date | null;
  recentVersions?: Array<{ version: string; publishedAt: Date }>;
  /** next/beta/canary (and rc/alpha/preview) tarballs that are not `latest`. */
  channelTarballs?: NpmChannelTarball[];
};

export type NpmPort = {
  getPack: (packageName: string, auth?: NpmAuth) => Promise<NpmPack | null>;
  downloadTarball: (url: string, maxBytes: number, auth?: NpmAuth) => Promise<Buffer>;
};

const NAME_RE = /^(?:@[a-z0-9][a-z0-9-._]{0,212}\/)?[a-z0-9][a-z0-9-._]{0,213}$/;

export function normalizePackageName(raw: string): string | null {
  const name = raw.trim().toLowerCase();
  if (!name || name.length > 214) return null;
  if (name.includes("..") || name.endsWith(".") || name.endsWith(".js") || name.endsWith(".node")) {
    return null;
  }
  if (!NAME_RE.test(name)) return null;
  return name;
}

export function allowedNpmTarballUrl(raw: string, allowedHost: string = PUBLIC_NPM_HOST): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:") {
    throw new Error("npm tarball URL must be https.");
  }
  if (url.username || url.password) {
    throw new Error("npm tarball URL must not include credentials.");
  }
  const host = url.hostname.toLowerCase();
  if (host !== allowedHost.toLowerCase()) {
    throw new Error(`npm tarball host is not ${allowedHost}.`);
  }
  return url;
}

export function sortDistTags(tags: NpmDistTags): NpmDistTags {
  return Object.fromEntries(Object.entries(tags).sort(([a], [b]) => a.localeCompare(b)));
}

export type WatchDelta =
  | { type: "first" }
  | { type: "new_version"; from: string; to: string }
  | { type: "mutated_tarball"; version: string }
  | { type: "dist_tags"; from: NpmDistTags; to: NpmDistTags }
  | { type: "unchanged" };

export function diffWatchedPack(
  previous: { version: string | null; shasum: string | null; distTags: NpmDistTags | null } | null,
  next: NpmPack,
): WatchDelta[] {
  if (!previous?.version) return [{ type: "first" }];
  const deltas: WatchDelta[] = [];
  if (previous.version !== next.version) {
    deltas.push({ type: "new_version", from: previous.version, to: next.version });
  } else if (
    previous.shasum &&
    next.shasum &&
    previous.shasum !== next.shasum
  ) {
    deltas.push({ type: "mutated_tarball", version: next.version });
  }
  const prevTags = JSON.stringify(sortDistTags(previous.distTags ?? {}));
  const nextTags = JSON.stringify(sortDistTags(next.distTags));
  if (prevTags !== nextTags && previous.version === next.version && deltas.every((d) => d.type !== "mutated_tarball")) {
    deltas.push({ type: "dist_tags", from: previous.distTags ?? {}, to: next.distTags });
  }
  return deltas.length > 0 ? deltas : [{ type: "unchanged" }];
}

export function channelTarballsFromRegistry(
  distTags: NpmDistTags,
  versions: RegistryBody["versions"],
  latestVersion: string,
  allowedHost: string,
): NpmChannelTarball[] {
  const out: NpmChannelTarball[] = [];
  for (const tag of WATCHED_DIST_TAGS) {
    if (out.length >= MAX_CHANNEL_SCANS) break;
    const version = distTags[tag];
    if (!version || typeof version !== "string" || version === latestVersion) continue;
    const dist = versions?.[version]?.dist;
    if (!dist?.tarball || typeof dist.tarball !== "string") continue;
    try {
      allowedNpmTarballUrl(dist.tarball, allowedHost);
    } catch {
      continue;
    }
    out.push({
      tag,
      version,
      tarballUrl: dist.tarball,
      shasum: typeof dist.shasum === "string" ? dist.shasum : null,
    });
  }
  return out;
}

export function channelScansForDelta(
  previousTags: NpmDistTags | null | undefined,
  pack: NpmPack,
): NpmChannelTarball[] {
  const channels = pack.channelTarballs ?? [];
  if (!previousTags) return channels;
  return channels.filter((row) => previousTags[row.tag] !== row.version);
}

type RegistryBody = {
  name?: string;
  maintainers?: unknown;
  repository?: unknown;
  homepage?: unknown;
  time?: Record<string, string>;
  "dist-tags"?: NpmDistTags;
  versions?: Record<
    string,
    {
      dist?: {
        tarball?: string;
        shasum?: string;
        integrity?: string;
        unpackedSize?: number;
      };
      bin?: unknown;
      scripts?: unknown;
      repository?: unknown;
      homepage?: unknown;
      maintainers?: unknown;
    }
  >;
};

export function parseRegistryTimes(
  time: Record<string, string> | undefined,
  version: string,
  now = Date.now(),
): { publishedAt: Date | null; recentVersions: Array<{ version: string; publishedAt: Date }> } {
  if (!time) return { publishedAt: null, recentVersions: [] };
  const versionStamp = time[version];
  const publishedAtRaw = versionStamp ? new Date(versionStamp) : null;
  const publishedAt =
    publishedAtRaw && !Number.isNaN(publishedAtRaw.getTime()) ? publishedAtRaw : null;
  const recentVersions: Array<{ version: string; publishedAt: Date }> = [];
  const since = now - 7 * 24 * 60 * 60 * 1000;
  for (const [key, iso] of Object.entries(time)) {
    if (key === "created" || key === "modified") continue;
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) continue;
    if (at.getTime() >= since) recentVersions.push({ version: key, publishedAt: at });
  }
  recentVersions.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
  return { publishedAt, recentVersions };
}

function repositoryUrlFrom(raw: unknown): string | null {
  if (typeof raw === "string") return asHttpsMetadataUrl(raw) ?? (raw.trim() || null);
  if (raw && typeof raw === "object") {
    const url = (raw as { url?: unknown }).url;
    if (typeof url === "string") return asHttpsMetadataUrl(url) ?? (url.trim() || null);
  }
  return null;
}

function homepageFrom(raw: unknown): string | null {
  return typeof raw === "string" ? asHttpsMetadataUrl(raw) ?? (raw.trim() || null) : null;
}

export function packFromRegistry(
  packageName: string,
  body: RegistryBody,
  allowedHost: string = PUBLIC_NPM_HOST,
): NpmPack | null {
  const distTags = body["dist-tags"] && typeof body["dist-tags"] === "object" ? body["dist-tags"] : {};
  const version = distTags.latest;
  if (!version || typeof version !== "string") return null;
  const dist = body.versions?.[version]?.dist;
  if (!dist?.tarball || typeof dist.tarball !== "string") return null;
  allowedNpmTarballUrl(dist.tarball, allowedHost);
  const versionMeta = body.versions?.[version];
  const times = parseRegistryTimes(body.time, version);
  return {
    name: typeof body.name === "string" ? body.name : packageName,
    version,
    distTags,
    tarballUrl: dist.tarball,
    shasum: typeof dist.shasum === "string" ? dist.shasum : null,
    integrity: typeof dist.integrity === "string" ? dist.integrity : null,
    bytes: typeof dist.unpackedSize === "number" ? dist.unpackedSize : null,
    publishedAt: times.publishedAt,
    recentVersions: times.recentVersions,
    channelTarballs: channelTarballsFromRegistry(distTags, body.versions, version, allowedHost),
    identity: {
      maintainers: normalizeMaintainerNames(versionMeta?.maintainers ?? body.maintainers),
      repositoryUrl:
        repositoryUrlFrom(versionMeta?.repository) ?? repositoryUrlFrom(body.repository),
      homepage: homepageFrom(versionMeta?.homepage) ?? homepageFrom(body.homepage),
      binNames: binNamesFromManifest(versionMeta?.bin),
      lifecycleScripts: lifecycleScriptsFromManifest(versionMeta?.scripts),
    },
  };
}

function resolveAuth(auth?: NpmAuth): { origin: string; host: string; token?: string } {
  if (!auth?.registryOrigin) {
    return { origin: PUBLIC_NPM_ORIGIN, host: PUBLIC_NPM_HOST };
  }
  const parsed = parseRegistryOrigin(auth.registryOrigin);
  if (!parsed) throw new Error("Invalid npm registry origin.");
  const token = auth.token?.trim();
  return {
    origin: parsed.origin,
    host: parsed.host,
    token: parsed.host === PUBLIC_NPM_HOST ? undefined : token || undefined,
  };
}

function npmHeaders(auth?: NpmAuth, acceptJson = false): Record<string, string> {
  const resolved = resolveAuth(auth);
  const headers: Record<string, string> = {
    "User-Agent": "NoSpoilers",
    ...(acceptJson ? { Accept: "application/json" } : {}),
  };
  if (resolved.token) headers.Authorization = `Bearer ${resolved.token}`;
  return headers;
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) throw new Error("npm download had no body.");
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error(`npm tarball is larger than ${maxBytes} bytes.`);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`npm tarball is larger than ${maxBytes} bytes.`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export function createNpmPort(): NpmPort {
  return {
    async getPack(packageName, auth) {
      const name = normalizePackageName(packageName);
      if (!name) throw new Error("Invalid npm package name.");
      const resolved = resolveAuth(auth);
      const response = await fetch(registryMetadataUrl(resolved.origin, name), {
        headers: npmHeaders(auth, true),
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`npm registry returned ${response.status}.`);
      const body = (await response.json()) as RegistryBody;
      return packFromRegistry(name, body, resolved.host);
    },
    async downloadTarball(url, maxBytes, auth) {
      const resolved = resolveAuth(auth);
      allowedNpmTarballUrl(url, resolved.host);
      const response = await fetch(url, {
        headers: npmHeaders(auth),
        redirect: "follow",
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw new Error(`npm tarball download returned ${response.status}.`);
      allowedNpmTarballUrl(response.url, resolved.host);
      return await readLimitedBody(response, maxBytes);
    },
  };
}
