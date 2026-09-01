const UUID_HYPHEN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const UUID_HEX32 = /[0-9a-f]{32}/i;

const DEBUG_KEY = /(?:debug_id|debugId)/i;
const DEBUG_COMMENT = /\/\/[#@]\s*debugId\s*=\s*([0-9a-f-]{32,36})/gi;
const DEBUG_ASSIGN =
  /["']?(?:debug_id|debugId)["']?\s*[:=]\s*["']([0-9a-f-]{32,36})["']/gi;

export const MAX_DEBUG_IDS = 20;
export const MAX_RELEASE_HINTS = 8;

export type MapIdentity = {
  debugIds: string[];
  releases: string[];
};

export function emptyMapIdentity(): MapIdentity {
  return { debugIds: [], releases: [] };
}

export function normalizeDebugId(raw: string): string | null {
  const hex = raw.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function looksLikeReleaseHint(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (/[\s/]/.test(trimmed) || trimmed.includes("://") || trimmed.includes("@")) return false;
  return /^[A-Za-z0-9._+-]+$/.test(trimmed);
}

export function uniqueStrings(values: string[], max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

export function mergeMapIdentity(into: MapIdentity, add: MapIdentity): MapIdentity {
  into.debugIds = uniqueStrings([...into.debugIds, ...add.debugIds], MAX_DEBUG_IDS);
  into.releases = uniqueStrings([...into.releases, ...add.releases], MAX_RELEASE_HINTS);
  return into;
}

function pushDebugId(into: string[], raw: string): void {
  const id = normalizeDebugId(raw);
  if (id) into.push(id);
}

function idsNearDebugKey(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(DEBUG_ASSIGN)) {
    if (match[1]) pushDebugId(found, match[1]);
  }
  DEBUG_COMMENT.lastIndex = 0;
  for (const match of text.matchAll(DEBUG_COMMENT)) {
    if (match[1]) pushDebugId(found, match[1]);
  }
  return found;
}

function idsFromJsonMap(text: string): string[] {
  const found: string[] = [];
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    for (const key of ["debug_id", "debugId"]) {
      const value = json[key];
      if (typeof value === "string") pushDebugId(found, value);
    }
    const debugMeta = json.debug_meta;
    if (debugMeta && typeof debugMeta === "object") {
      const ids = (debugMeta as { ids?: unknown }).ids;
      if (Array.isArray(ids)) {
        for (const row of ids) {
          if (!row || typeof row !== "object") continue;
          const rec = row as Record<string, unknown>;
          if (typeof rec.debug_id === "string") pushDebugId(found, rec.debug_id);
          if (typeof rec.debugId === "string") pushDebugId(found, rec.debugId);
        }
      }
    }
  } catch {
    if (DEBUG_KEY.test(text)) {
      for (const match of text.matchAll(new RegExp(`${DEBUG_KEY.source}[^0-9a-f]{0,24}(${UUID_HYPHEN.source}|${UUID_HEX32.source})`, "gi"))) {
        if (match[1]) pushDebugId(found, match[1]);
      }
    }
  }
  return found;
}

function releaseFromJson(text: string): string | null {
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    if (typeof json.release === "string" && looksLikeReleaseHint(json.release)) {
      return json.release.trim();
    }
    if (typeof json.version === "string" && looksLikeReleaseHint(json.version)) {
      return json.version.trim();
    }
  } catch {
    const release = /"release"\s*:\s*"([^"]{1,80})"/.exec(text)?.[1];
    if (release && looksLikeReleaseHint(release)) return release.trim();
  }
  return null;
}

export function extractMapIdentity(rel: string, buf: Buffer): MapIdentity {
  const identity = emptyMapIdentity();
  const base = rel.replace(/\\/g, "/").split("/").pop() ?? rel;
  const text = buf.subarray(0, 512_000).toString("utf8");
  if (!text.trim()) return identity;

  identity.debugIds.push(...idsNearDebugKey(text));
  const looksMap =
    /\.map$/i.test(base) ||
    (text.trimStart().startsWith("{") && /"mappings"\s*:/.test(text) && /"sources"\s*:/.test(text));
  if (looksMap) {
    identity.debugIds.push(...idsFromJsonMap(text));
    const release = releaseFromJson(text);
    if (release) identity.releases.push(release);
  }

  if (/^package\.json$/i.test(base) && text.trimStart().startsWith("{")) {
    try {
      const json = JSON.parse(text) as { version?: unknown };
      if (typeof json.version === "string" && looksLikeReleaseHint(json.version)) {
        identity.releases.push(json.version.trim());
      }
    } catch {
      /* ignore malformed package.json */
    }
  }

  return {
    debugIds: uniqueStrings(identity.debugIds, MAX_DEBUG_IDS),
    releases: uniqueStrings(identity.releases, MAX_RELEASE_HINTS),
  };
}

export function publicMapFromFindings(findings: Array<{ rule: string }>): boolean {
  return findings.some(
    (finding) => finding.rule === "MAP-001" || finding.rule === "MAP-002" || finding.rule === "MAP-003",
  );
}
