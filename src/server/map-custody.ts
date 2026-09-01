import { createHash } from "node:crypto";
import { isBlockedRegistryHost } from "./npm-registry.ts";
import {
  assertPublicWebhookHost,
  type WebhookHostLookup,
} from "./siem.ts";
import type { Finding, ScanStatus } from "../scanner/types.ts";
import { uniqueStrings } from "../scanner/debug-id.ts";

export const DEFAULT_SENTRY_HOST = "sentry.io";
export const DEFAULT_BUGSNAG_HOST = "api.bugsnag.com";
export const MAX_MAP_LOOKUPS = 8;
export const MAP_CUSTODY_TIMEOUT_MS = 8_000;

const HOST_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const MAX_TOKEN = 500;

export type MapDestinationKind = "sentry" | "bugsnag";

export type ParsedMapDestination = {
  kind: MapDestinationKind;
  host: string;
  origin: string;
  orgSlug: string | null;
  projectSlug: string;
};

export type MapIdentitySnapshot = {
  source: "origin" | "package";
  label: string;
  debugIds: string[];
  release: string | null;
  publicMap: boolean;
};

export class MapCustodyError extends Error {
  readonly inconclusive = true;
  constructor(message: string) {
    super(message);
    this.name = "MapCustodyError";
  }
}

export function parseMapDestinationKind(raw: string): MapDestinationKind | null {
  const kind = raw.trim().toLowerCase();
  if (kind === "sentry" || kind === "bugsnag") return kind;
  return null;
}

export function isSentrySaasHost(host: string): boolean {
  const name = host.trim().toLowerCase();
  return name === DEFAULT_SENTRY_HOST || name.endsWith(`.${DEFAULT_SENTRY_HOST}`);
}

export function isBugsnagSaasHost(host: string): boolean {
  const name = host.trim().toLowerCase();
  return name === DEFAULT_BUGSNAG_HOST || name === "upload.bugsnag.com";
}

function parseHost(raw: string, fallback: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (trimmed.length > 253) return null;
  let host = trimmed.toLowerCase();
  if (trimmed.includes("://") || trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (url.hash) return null;
    if (url.pathname && url.pathname !== "/") return null;
    if (url.search) return null;
    if (url.port && url.port !== "443") return null;
    host = url.hostname.toLowerCase();
  }
  if (host.includes("/") || host.includes("\\") || host.includes("..")) return null;
  if (isBlockedRegistryHost(host)) return null;
  if (!HOST_RE.test(host)) return null;
  return host;
}

function parseSlug(raw: string, required: boolean): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return required ? null : "";
  if (!SLUG_RE.test(trimmed)) return null;
  return trimmed;
}

export function parseMapDestination(input: {
  kind: string;
  host?: string;
  org?: string;
  project: string;
}): ParsedMapDestination | null {
  const kind = parseMapDestinationKind(input.kind);
  if (!kind) return null;
  const fallback = kind === "sentry" ? DEFAULT_SENTRY_HOST : DEFAULT_BUGSNAG_HOST;
  const host = parseHost(input.host ?? "", fallback);
  if (!host) return null;
  if (kind === "sentry" && !isSentrySaasHost(host) && host === DEFAULT_BUGSNAG_HOST) return null;
  if (kind === "bugsnag" && isSentrySaasHost(host)) return null;
  const projectSlug = parseSlug(input.project, true);
  if (!projectSlug) return null;
  const orgSlug = kind === "sentry" ? parseSlug(input.org ?? "", true) : parseSlug(input.org ?? "", false);
  if (kind === "sentry" && !orgSlug) return null;
  if (orgSlug === null) return null;
  return {
    kind,
    host,
    origin: `https://${host}`,
    orgSlug: orgSlug || null,
    projectSlug,
  };
}

export function validateMapToken(raw: string): string | null {
  const token = raw.trim();
  if (!token || token.length > MAX_TOKEN) return null;
  if (/[\r\n\0]/.test(token)) return null;
  return token;
}

export type MapCustodyVerdict = {
  status: ScanStatus;
  findings: Finding[];
  inconclusiveReason: string | null;
};

function finding(
  rule: "MAP-011" | "MAP-012",
  path: string,
  title: string,
  detail: string,
): Finding {
  return { rule, severity: "critical", path, title, detail };
}

export function evaluateMapCustody(input: {
  kind: MapDestinationKind;
  host: string;
  identities: MapIdentitySnapshot[];
  debugPresent: Array<{ id: string; present: boolean }>;
  releasePresent: Array<{ version: string; present: boolean }>;
  lookupError: string | null;
  bugsnagNeedsRelease: boolean;
}): MapCustodyVerdict {
  const findings: Finding[] = [];
  const publicHits = input.identities.filter((row) => row.publicMap);
  for (const row of publicHits) {
    findings.push(
      finding(
        "MAP-012",
        row.label,
        "Public map is still served",
        `${row.source === "origin" ? "Website" : "Package"} ${row.label} still ships a source map or map URL while private map custody is connected. Private upload does not make a public map safe.`,
      ),
    );
  }

  if (input.lookupError) {
    return {
      status: findings.length > 0 ? "failed-policy" : "inconclusive",
      findings,
      inconclusiveReason: findings.length > 0 ? null : input.lookupError,
    };
  }

  if (input.kind === "sentry") {
    for (const row of input.debugPresent) {
      if (row.present) continue;
      findings.push(
        finding(
          "MAP-011",
          input.host,
          "Private Sentry has no artifact for this debug ID",
          `Sentry project on ${input.host} has no debug file for ${row.id}. Upload the map privately and keep it off the public site.`,
        ),
      );
    }
    const debugIds = uniqueStrings(
      input.identities.flatMap((row) => row.debugIds),
      MAX_MAP_LOOKUPS,
    );
    if (debugIds.length === 0 && publicHits.length === 0) {
      return {
        status: "inconclusive",
        findings,
        inconclusiveReason:
          "No debug ID found in watched JavaScript or maps. Sentry custody needs a debug ID from the bundle.",
      };
    }
  }

  if (input.kind === "bugsnag") {
    if (input.bugsnagNeedsRelease) {
      return {
        status: findings.length > 0 ? "failed-policy" : "inconclusive",
        findings,
        inconclusiveReason:
          findings.length > 0
            ? null
            : "Bugsnag custody matches a release version. This API cannot look up a debug ID.",
      };
    }
    for (const row of input.releasePresent) {
      if (row.present) continue;
      findings.push(
        finding(
          "MAP-011",
          input.host,
          "Private Bugsnag has no matching release",
          `Bugsnag on ${input.host} has no release ${row.version}. Upload the map privately for that version and keep it off the public site.`,
        ),
      );
    }
  }

  if (findings.length > 0) {
    return { status: "failed-policy", findings, inconclusiveReason: null };
  }
  return { status: "passed", findings, inconclusiveReason: null };
}

export function custodyFingerprint(verdict: MapCustodyVerdict): string {
  const payload = {
    status: verdict.status,
    reason: verdict.inconclusiveReason,
    findings: verdict.findings
      .map((row) => ({ rule: row.rule, path: row.path, title: row.title }))
      .sort((a, b) => `${a.rule}:${a.path}`.localeCompare(`${b.rule}:${b.path}`)),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function readJson(response: Response): Promise<unknown> {
  const buf = Buffer.from(await response.arrayBuffer());
  if (buf.length > 256_000) {
    throw new MapCustodyError("Map destination response was larger than the 256 KiB lookup limit.");
  }
  const text = buf.toString("utf8");
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new MapCustodyError("Map destination returned malformed JSON.");
  }
}

export async function lookupSentryDebugId(input: {
  origin: string;
  orgSlug: string;
  projectSlug: string;
  debugId: string;
  token: string;
  fetch?: typeof fetch;
  lookup?: WebhookHostLookup;
}): Promise<boolean> {
  const host = new URL(input.origin).hostname;
  const publicHost = await assertPublicWebhookHost(host, input.lookup);
  if (!publicHost) {
    throw new MapCustodyError("Sentry host resolved to a private or reserved address.");
  }
  const url = `${input.origin}/api/0/projects/${encodeURIComponent(input.orgSlug)}/${encodeURIComponent(input.projectSlug)}/artifact-lookup/?debug_id=${encodeURIComponent(input.debugId)}`;
  const fetchImpl = input.fetch ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      redirect: "error",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${input.token}`,
      },
      signal: AbortSignal.timeout(MAP_CUSTODY_TIMEOUT_MS),
    });
  } catch (error) {
    throw new MapCustodyError(error instanceof Error ? error.message : "Sentry lookup failed.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new MapCustodyError("Sentry rejected the token.");
  }
  if (response.status === 404) {
    throw new MapCustodyError("Sentry project was not found.");
  }
  if (!response.ok) {
    throw new MapCustodyError(`Sentry returned HTTP ${response.status}.`);
  }
  const json = await readJson(response);
  return Array.isArray(json) && json.length > 0;
}

function releaseVersionOf(row: unknown): string | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  for (const key of ["app_version", "version", "appVersion"]) {
    if (typeof rec[key] === "string" && rec[key].trim()) return rec[key].trim();
  }
  return null;
}

export async function listBugsnagReleaseVersions(input: {
  origin: string;
  projectSlug: string;
  token: string;
  fetch?: typeof fetch;
  lookup?: WebhookHostLookup;
}): Promise<string[]> {
  const host = new URL(input.origin).hostname;
  const publicHost = await assertPublicWebhookHost(host, input.lookup);
  if (!publicHost) {
    throw new MapCustodyError("Bugsnag host resolved to a private or reserved address.");
  }
  const url = `${input.origin}/projects/${encodeURIComponent(input.projectSlug)}/releases?per_page=30`;
  const fetchImpl = input.fetch ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      redirect: "error",
      headers: {
        accept: "application/json",
        authorization: `token ${input.token}`,
        "x-version": "2",
      },
      signal: AbortSignal.timeout(MAP_CUSTODY_TIMEOUT_MS),
    });
  } catch (error) {
    throw new MapCustodyError(error instanceof Error ? error.message : "Bugsnag lookup failed.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new MapCustodyError("Bugsnag rejected the token.");
  }
  if (response.status === 404) {
    throw new MapCustodyError("Bugsnag project was not found.");
  }
  if (!response.ok) {
    throw new MapCustodyError(`Bugsnag returned HTTP ${response.status}.`);
  }
  const json = await readJson(response);
  const rows = Array.isArray(json)
    ? json
    : json && typeof json === "object" && Array.isArray((json as { releases?: unknown }).releases)
      ? ((json as { releases: unknown[] }).releases)
      : null;
  if (!rows) {
    throw new MapCustodyError("Bugsnag returned an unexpected releases payload.");
  }
  return uniqueStrings(rows.map((row) => releaseVersionOf(row) ?? "").filter(Boolean), 40);
}

export async function runMapCustodyCheck(input: {
  kind: MapDestinationKind;
  host: string;
  origin: string;
  orgSlug: string | null;
  projectSlug: string;
  token: string;
  identities: MapIdentitySnapshot[];
  fetch?: typeof fetch;
  lookup?: WebhookHostLookup;
}): Promise<MapCustodyVerdict> {
  const debugIds = uniqueStrings(
    input.identities.flatMap((row) => row.debugIds),
    MAX_MAP_LOOKUPS,
  );
  const releases = uniqueStrings(
    input.identities.map((row) => row.release ?? "").filter(Boolean),
    MAX_MAP_LOOKUPS,
  );

  try {
    if (input.kind === "sentry") {
      if (!input.orgSlug) {
        return evaluateMapCustody({
          kind: input.kind,
          host: input.host,
          identities: input.identities,
          debugPresent: [],
          releasePresent: [],
          lookupError: "Sentry custody needs an organization slug.",
          bugsnagNeedsRelease: false,
        });
      }
      const debugPresent: Array<{ id: string; present: boolean }> = [];
      for (const id of debugIds) {
        const present = await lookupSentryDebugId({
          origin: input.origin,
          orgSlug: input.orgSlug,
          projectSlug: input.projectSlug,
          debugId: id,
          token: input.token,
          fetch: input.fetch,
          lookup: input.lookup,
        });
        debugPresent.push({ id, present });
      }
      return evaluateMapCustody({
        kind: input.kind,
        host: input.host,
        identities: input.identities,
        debugPresent,
        releasePresent: [],
        lookupError: null,
        bugsnagNeedsRelease: false,
      });
    }

    if (releases.length === 0) {
      return evaluateMapCustody({
        kind: input.kind,
        host: input.host,
        identities: input.identities,
        debugPresent: [],
        releasePresent: [],
        lookupError: null,
        bugsnagNeedsRelease: true,
      });
    }
    const versions = await listBugsnagReleaseVersions({
      origin: input.origin,
      projectSlug: input.projectSlug,
      token: input.token,
      fetch: input.fetch,
      lookup: input.lookup,
    });
    const have = new Set(versions);
    return evaluateMapCustody({
      kind: input.kind,
      host: input.host,
      identities: input.identities,
      debugPresent: [],
      releasePresent: releases.map((version) => ({ version, present: have.has(version) })),
      lookupError: null,
      bugsnagNeedsRelease: false,
    });
  } catch (error) {
    const message =
      error instanceof MapCustodyError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Map custody lookup failed.";
    return evaluateMapCustody({
      kind: input.kind,
      host: input.host,
      identities: input.identities,
      debugPresent: [],
      releasePresent: [],
      lookupError: message,
      bugsnagNeedsRelease: false,
    });
  }
}
