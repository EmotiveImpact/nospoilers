export const PUBLIC_NPM_HOST = "registry.npmjs.org";
export const PUBLIC_NPM_ORIGIN = "https://registry.npmjs.org";
export const MAX_NPM_REGISTRIES = 5;
export const MAX_REGISTRY_TOKEN_CHARS = 8192;

export type NpmRegistryOrigin = {
  origin: string;
  host: string;
};

function ipv4Octets(host: string): number[] | null {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
  const parts = host.split(".").map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return parts;
}

export function isBlockedRegistryHost(host: string): boolean {
  const name = host.trim().toLowerCase();
  if (!name) return true;
  if (name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local")) return true;
  if (name.endsWith(".internal") || name.endsWith(".lan") || name.endsWith(".home")) return true;
  if (name === "metadata.google.internal" || name.endsWith(".metadata.google.internal")) return true;
  if (name.includes(":")) return true;
  const ip = ipv4Octets(name);
  if (ip) {
    const [a, b] = ip;
    if (a === 0 || a === 10 || a === 127 || a === 224 || a === 255) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true;
    return true;
  }
  return false;
}

export function parseRegistryOrigin(raw: string): NpmRegistryOrigin | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 200) return null;
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.search || url.hash) return null;
  const host = url.hostname.toLowerCase();
  if (!host || host.length > 253) return null;
  if (isBlockedRegistryHost(host)) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host)) {
    return null;
  }
  const port = url.port && url.port !== "443" ? `:${url.port}` : "";
  let path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
  if (path.includes("..") || path.includes("//") || path.includes("\\")) return null;
  if (path && !/^\/[A-Za-z0-9._/-]+$/.test(path)) return null;
  return { origin: `https://${host}${port}${path}`, host };
}

export function isPublicNpmOrigin(origin: string): boolean {
  const parsed = parseRegistryOrigin(origin);
  return parsed?.origin === PUBLIC_NPM_ORIGIN;
}

export function validateRegistryToken(raw: string): string | null {
  const token = raw.trim();
  if (token.length < 8 || token.length > MAX_REGISTRY_TOKEN_CHARS) return null;
  if (/\s/.test(token)) return null;
  if (token.includes("\0")) return null;
  return token;
}

export function registryMetadataUrl(origin: string, packageName: string): string {
  const parsed = parseRegistryOrigin(origin);
  if (!parsed) throw new Error("Invalid npm registry origin.");
  return `${parsed.origin}/${encodeURIComponent(packageName)}`;
}
