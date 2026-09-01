import {
  parseRegistryOrigin,
  PUBLIC_NPM_HOST,
  PUBLIC_NPM_ORIGIN,
  registryMetadataUrl,
} from "./npm-registry.ts";

export type NpmDistTags = Record<string, string>;

export type NpmAuth = {
  registryOrigin: string;
  token?: string;
};

export type NpmPack = {
  name: string;
  version: string;
  distTags: NpmDistTags;
  tarballUrl: string;
  shasum: string | null;
  integrity: string | null;
  bytes: number | null;
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

type RegistryBody = {
  name?: string;
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
    }
  >;
};

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
  return {
    name: typeof body.name === "string" ? body.name : packageName,
    version,
    distTags,
    tarballUrl: dist.tarball,
    shasum: typeof dist.shasum === "string" ? dist.shasum : null,
    integrity: typeof dist.integrity === "string" ? dist.integrity : null,
    bytes: typeof dist.unpackedSize === "number" ? dist.unpackedSize : null,
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
