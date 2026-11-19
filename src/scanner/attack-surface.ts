/**
 * Attacker-view signals pulled from shipped JavaScript and from source rebuilt
 * out of public source maps.
 *
 * Only short identifiers are kept: route paths, feature-flag keys, internal
 * hostnames and environment variable NAMES. Credential values, file contents and
 * code are never collected. Anything that looks like a secret is dropped rather
 * than redacted, so a match can never smuggle a token into a report.
 */
import path from "node:path";

export type AttackSurface = {
  /** Application routes that read as hidden, internal, admin or API surface. */
  routes: string[];
  /** Feature-flag keys referenced by flag helpers or FEATURE_/FF_ constants. */
  flags: string[];
  /** Hostnames that read as internal, staging or private network. */
  hosts: string[];
  /** Environment variable names (never values). */
  envNames: string[];
  /** Number of files or rebuilt sources that contributed. */
  sources: number;
  /** True when a category hit its cap. */
  truncated: boolean;
};

const CAP = 60;
const MAX_ITEM = 120;
const MAX_TEXT = 2_000_000;

export function emptyAttackSurface(): AttackSurface {
  return { routes: [], flags: [], hosts: [], envNames: [], sources: 0, truncated: false };
}

const SECRET_SHAPE =
  /(?:github_pat_|gh[pousr]_|npm_[A-Za-z0-9]{20}|sk_live_|rk_live_|sk-(?:proj|svcacct|ant)-|xox[baprs]-|glpat-|AKIA[A-Z0-9]{8}|ASIA[A-Z0-9]{8}|AIza[0-9A-Za-z_-]{20}|eyJ[A-Za-z0-9_-]{10,}\.)/;

function looksSecret(value: string): boolean {
  if (SECRET_SHAPE.test(value)) return true;
  // Long unbroken high-entropy runs are tokens, not identifiers.
  for (const run of value.split(/[/.:_-]/)) {
    if (run.length >= 32 && /[A-Za-z]/.test(run) && /\d/.test(run)) return true;
  }
  return false;
}

function clean(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_ITEM) return null;
  if ([...trimmed].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  })) return null;
  if (looksSecret(trimmed)) return null;
  return trimmed;
}

function add(list: string[], value: string, surface: AttackSurface): void {
  const item = clean(value);
  if (!item || list.includes(item)) return;
  if (list.length >= CAP) {
    surface.truncated = true;
    return;
  }
  list.push(item);
}

const ROUTE =
  /["'`](\/(?:api|admin|_?internal|debug|graphql|private|beta|staff|ops|console|dashboard|manage|backoffice|v\d+)(?:\/[A-Za-z0-9_\-:.{}$[\]]*)*)["'`?#]/gi;

const FLAG_CALL =
  /\b(?:isEnabled|isFeatureEnabled|featureEnabled|useFlag|useFeatureFlag|useFeature|getFeatureFlag|getFlag|checkGate|useGate|variation|boolVariation|isOn)\(\s*["'`]([A-Za-z0-9_.:-]{2,80})["'`]/g;

const FLAG_CONST = /\b((?:FEATURE|FF|FLAG|ENABLE)_[A-Z0-9_]{2,80})\b/g;

const ENV_NAME =
  /\b(?:process\.env|import\.meta\.env)(?:\.([A-Z_][A-Z0-9_]{1,80})|\[\s*["'`]([A-Z_][A-Z0-9_]{1,80})["'`]\s*\])/g;

const HOST =
  /\bhttps?:\/\/((?:localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+))(?::\d{2,5})?/g;

const INTERNAL_LABEL =
  /(?:^|[.-])(?:internal|intranet|corp|staging|stage|stg|dev|qa|uat|preprod|sandbox|admin|vpn|private|local|test)(?:[.-]|$)/i;

function internalHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (/^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(lower)) return true;
  if (lower.endsWith(".internal") || lower.endsWith(".local") || lower.endsWith(".lan")) return true;
  return INTERNAL_LABEL.test(lower);
}

/** Collect from one text body. Callers decide which files are worth reading. */
export function collectAttackSurfaceText(surface: AttackSurface, text: string): void {
  const body = text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
  surface.sources += 1;
  for (const match of body.matchAll(ROUTE)) add(surface.routes, match[1], surface);
  for (const match of body.matchAll(FLAG_CALL)) add(surface.flags, match[1], surface);
  for (const match of body.matchAll(FLAG_CONST)) add(surface.flags, match[1], surface);
  for (const match of body.matchAll(ENV_NAME)) add(surface.envNames, match[1] ?? match[2], surface);
  for (const match of body.matchAll(HOST)) {
    if (internalHost(match[1])) add(surface.hosts, match[1].toLowerCase(), surface);
  }
}

const CODE_FILE = /\.(?:js|mjs|cjs|jsx|ts|tsx|mts|cts|vue|svelte|html?)$/i;

/** True for shipped files the scanner should read for attacker-view signals. */
export function attackSurfaceCandidate(relPath: string): boolean {
  const base = path.posix.basename(relPath.split(path.sep).join("/"));
  return CODE_FILE.test(base);
}

export function mergeAttackSurface(into: AttackSurface, add_: AttackSurface): void {
  into.sources += add_.sources;
  into.truncated = into.truncated || add_.truncated;
  for (const key of ["routes", "flags", "hosts", "envNames"] as const) {
    for (const value of add_[key]) add(into[key], value, into);
  }
}

export function sortedAttackSurface(surface: AttackSurface): AttackSurface {
  return {
    routes: [...surface.routes].sort(),
    flags: [...surface.flags].sort(),
    hosts: [...surface.hosts].sort(),
    envNames: [...surface.envNames].sort(),
    sources: surface.sources,
    truncated: surface.truncated,
  };
}
