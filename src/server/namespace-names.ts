import { PUBLIC_NPM_ORIGIN } from "./npm-registry.ts";

export const NAMESPACE_SEARCH_SIZE = 20;
export const NAMESPACE_INVALID_ERROR = "Use an npm scope, like @scope.";

export type NamespaceSearchHit = {
  name: string;
  version: string | null;
};

const SCOPE_RE = /^@[a-z0-9][a-z0-9-._]{0,212}$/;
const PACK_RE = /^@[a-z0-9][a-z0-9-._]{0,212}\/[a-z0-9][a-z0-9-._]{0,213}$/;

export function normalizeNpmScope(raw: string): string | null {
  let value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value.endsWith("/*")) value = value.slice(0, -2);
  if (value.endsWith("/")) value = value.slice(0, -1);
  if (!value.startsWith("@")) value = `@${value}`;
  if (value.includes("/") || value.includes("..") || value.includes("\\")) return null;
  if (value.length > 214) return null;
  if (!SCOPE_RE.test(value)) return null;
  return value;
}

export function verifyNamespaceOwnership(scope: string, installationLogin: string): boolean {
  const normalized = normalizeNpmScope(scope);
  const login = installationLogin.trim().toLowerCase();
  if (!normalized || !login) return false;
  return normalized === `@${login}`;
}

export function registryScopeSearchUrl(scope: string): string {
  const normalized = normalizeNpmScope(scope);
  if (!normalized) throw new Error(NAMESPACE_INVALID_ERROR);
  const bare = normalized.slice(1);
  return `${PUBLIC_NPM_ORIGIN}/-/v1/search?text=${encodeURIComponent(`scope:${bare}`)}&size=${NAMESPACE_SEARCH_SIZE}`;
}

export function parseScopeSearchHits(scope: string, body: unknown): NamespaceSearchHit[] {
  const normalized = normalizeNpmScope(scope);
  if (!normalized) return [];
  const prefix = `${normalized}/`;
  const root = body && typeof body === "object" ? (body as { objects?: unknown }).objects : null;
  if (!Array.isArray(root)) return [];
  const hits: NamespaceSearchHit[] = [];
  const seen = new Set<string>();
  for (const entry of root) {
    if (!entry || typeof entry !== "object") continue;
    const pack = (entry as { package?: unknown }).package;
    if (!pack || typeof pack !== "object") continue;
    const rawName = (pack as { name?: unknown }).name;
    if (typeof rawName !== "string") continue;
    const name = rawName.trim().toLowerCase();
    if (!name.startsWith(prefix) || !PACK_RE.test(name) || seen.has(name)) continue;
    const rawVersion = (pack as { version?: unknown }).version;
    const version =
      typeof rawVersion === "string" && rawVersion.trim() && rawVersion.length <= 128
        ? rawVersion.trim()
        : null;
    seen.add(name);
    hits.push({ name, version });
    if (hits.length >= NAMESPACE_SEARCH_SIZE) break;
  }
  return hits.sort((a, b) => a.name.localeCompare(b.name));
}
