import { createHash } from "node:crypto";
import { isBlockedRegistryHost } from "./npm-registry.ts";
import {
  assertPublicWebhookHost,
  lookupWebhookHost,
  type WebhookHostLookup,
} from "./siem.ts";
import type { AlertNotifier } from "./notifier.ts";
import type { Store } from "./store.ts";

export const MAX_DELIVERY_LOCATIONS_PER_REVISION = 5;
export const MAX_DELIVERY_LOCATIONS_PER_INSTALL = 20;
export const MAX_DELIVERY_REDIRECTS = 3;
export const MAX_DELIVERY_URL_CHARS = 4000;
export const DELIVERY_FETCH_TIMEOUT_MS = 30_000;
export const MAX_DELIVERY_BYTES = 80 * 1024 * 1024;

const GITHUB_DOWNLOAD_HOSTS = new Set(["github.com", "www.github.com"]);
const GITHUB_ASSET_HOSTS = new Set([
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "github-releases.githubusercontent.com",
]);

const HOST_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const MEDIA_TYPE_RE = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,63}$/;

export const DELIVERY_VERIFY_KIND = "delivery_verify";

export type DeliveryUrl = {
  url: string;
  host: string;
  redacted: string;
};

export type DeliveryVerifyStatus =
  | "matched"
  | "mismatch"
  | "missing"
  | "redirect"
  | "content_type"
  | "blocked"
  | "error";

export type DeliveryVerifyResult = {
  status: DeliveryVerifyStatus;
  observedSha256: string | null;
  observedSha512: string | null;
  observedBytes: number | null;
  observedMediaType: string | null;
  finalHost: string | null;
  redirectCount: number;
  redirectHosts: string | null;
  cacheState: string | null;
  deliveryRegion: string | null;
  error: string | null;
};

export class DeliveryVerifyError extends Error {
  readonly status: 400 | 409;
  constructor(message: string, status: 400 | 409 = 400) {
    super(message);
    this.name = "DeliveryVerifyError";
    this.status = status;
  }
}

export function parseDeliveryUrl(raw: string): DeliveryUrl | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_DELIVERY_URL_CHARS) return null;
  if (trimmed.includes("\\")) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.hash) return null;
  const host = url.hostname.toLowerCase();
  if (!host || host.length > 253) return null;
  if (isBlockedRegistryHost(host)) return null;
  if (!HOST_RE.test(host)) return null;
  if (url.port) {
    const port = Number(url.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535 || port === 80) return null;
  }
  if (url.pathname.includes("..") || url.pathname.includes("//") || url.pathname.includes("\\")) {
    return null;
  }
  const port = url.port && url.port !== "443" ? `:${url.port}` : "";
  const path = url.pathname || "/";
  const search = url.search;
  return {
    url: `https://${host}${port}${path}${search}`,
    host,
    redacted: `https://${host}${port}${path}`,
  };
}

export function redactDeliveryUrl(url: string): string {
  return parseDeliveryUrl(url)?.redacted ?? "https://redacted.invalid/";
}

export function isExpectedGithubAssetRedirect(fromHost: string, toHost: string): boolean {
  const from = fromHost.trim().toLowerCase();
  const to = toHost.trim().toLowerCase();
  if (!from || !to) return false;
  if (from === to) return true;
  return GITHUB_DOWNLOAD_HOSTS.has(from) && GITHUB_ASSET_HOSTS.has(to);
}

const S3_PATH_STYLE_HOST =
  /^(?:s3\.amazonaws\.com|s3(?:\.dualstack)?\.[a-z0-9-]+\.amazonaws\.com)$/;
const S3_VIRTUAL_HOST =
  /^(.+)\.s3(?:\.dualstack)?(?:\.[a-z0-9-]+)?\.amazonaws\.com$/;
const R2_API_SUFFIX = ".r2.cloudflarestorage.com";

function firstUrlPathSegment(pathname: string): string | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function isObjectStoreBucketName(name: string): boolean {
  if (name.length < 3 || name.length > 63) return false;
  if (!/^[a-z0-9](?:[a-z0-9.-]{1,61}[a-z0-9])$/.test(name)) return false;
  if (name.includes("..")) return false;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(name)) return false;
  return true;
}

function isR2AccountId(name: string): boolean {
  return /^[a-f0-9]{32}$/.test(name);
}

function parseS3Delivery(url: URL): { bucket: string } | null {
  const host = url.hostname.toLowerCase();
  if (S3_PATH_STYLE_HOST.test(host)) {
    const bucket = firstUrlPathSegment(url.pathname);
    return bucket && isObjectStoreBucketName(bucket) ? { bucket: bucket.toLowerCase() } : null;
  }
  const virtual = host.match(S3_VIRTUAL_HOST);
  const bucket = virtual?.[1];
  return bucket && isObjectStoreBucketName(bucket) ? { bucket: bucket.toLowerCase() } : null;
}

function parseR2Delivery(url: URL): { account: string; bucket: string } | null {
  const host = url.hostname.toLowerCase();
  if (!host.endsWith(R2_API_SUFFIX)) return null;
  const rest = host.slice(0, -R2_API_SUFFIX.length);
  if (!rest) return null;
  const labels = rest.split(".");
  if (labels.some((label) => !label)) return null;
  if (labels.length === 1) {
    const account = labels[0];
    const bucket = firstUrlPathSegment(url.pathname);
    if (!isR2AccountId(account) || !bucket || !isObjectStoreBucketName(bucket)) return null;
    return { account, bucket: bucket.toLowerCase() };
  }
  const account = labels[labels.length - 1];
  const bucket = labels.slice(0, -1).join(".");
  if (!isR2AccountId(account) || !isObjectStoreBucketName(bucket)) return null;
  return { account, bucket: bucket.toLowerCase() };
}

/** Same-bucket S3, same-account R2, or GitHub Release → asset CDN. Other hosts are not fetched. */
export function isExpectedDeliveryRedirect(fromUrl: string, toUrl: string): boolean {
  const from = parseDeliveryUrl(fromUrl);
  const to = parseDeliveryUrl(toUrl);
  if (!from || !to) return false;
  if (from.host === to.host) return true;
  if (isExpectedGithubAssetRedirect(from.host, to.host)) return true;
  let fromParsed: URL;
  let toParsed: URL;
  try {
    fromParsed = new URL(from.url);
    toParsed = new URL(to.url);
  } catch {
    return false;
  }
  const fromS3 = parseS3Delivery(fromParsed);
  const toS3 = parseS3Delivery(toParsed);
  if (fromS3 && toS3 && fromS3.bucket === toS3.bucket) return true;
  const fromR2 = parseR2Delivery(fromParsed);
  const toR2 = parseR2Delivery(toParsed);
  return Boolean(
    fromR2 && toR2 && fromR2.account === toR2.account && fromR2.bucket === toR2.bucket,
  );
}

export function joinRedirectHosts(hosts: string[]): string | null {
  const ordered: string[] = [];
  for (const host of hosts) {
    const name = host.trim().toLowerCase();
    if (!name || !HOST_RE.test(name)) continue;
    if (ordered[ordered.length - 1] === name) continue;
    ordered.push(name);
  }
  if (!ordered.length) return null;
  return ordered.join(",");
}

export function parseDeliveryRegion(host: string | null | undefined): string | null {
  const name = host?.trim().toLowerCase() ?? "";
  if (!name) return null;
  if (GITHUB_DOWNLOAD_HOSTS.has(name) || GITHUB_ASSET_HOSTS.has(name)) return "github";
  if (name.endsWith(R2_API_SUFFIX)) return "r2";
  const dualstack = name.match(/(?:^|\.)s3\.dualstack\.([a-z0-9-]+)\.amazonaws\.com$/);
  if (dualstack?.[1]) return dualstack[1];
  const regional = name.match(/(?:^|\.)s3\.([a-z0-9-]+)\.amazonaws\.com$/);
  if (regional?.[1]) return regional[1];
  if (name === "s3.amazonaws.com" || name.endsWith(".s3.amazonaws.com")) return "us-east-1";
  return null;
}

export function normalizeDeliveryCacheState(
  headers: Pick<Headers, "get"> | { get(name: string): string | null },
): string | null {
  const cf = headers.get("cf-cache-status")?.trim().toLowerCase() ?? "";
  if (/^[a-z]{2,20}$/.test(cf)) return `cf:${cf}`;
  const xcache = headers.get("x-cache")?.trim().toLowerCase() ?? "";
  if (/\bhit\b/.test(xcache)) return "x-cache:hit";
  if (/\bmiss\b/.test(xcache)) return "x-cache:miss";
  const control = headers.get("cache-control")?.trim().toLowerCase() ?? "";
  if (control.includes("no-store")) return "no-store";
  if (control.includes("no-cache")) return "no-cache";
  const age = headers.get("age")?.trim() ?? "";
  if (/^\d{1,10}$/.test(age) && Number(age) > 0) return "aged";
  return null;
}

export function parseDeliveryMediaType(raw: string | undefined | null): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const value = normalizeMediaType(String(raw));
  if (!value || value.length > 100 || !MEDIA_TYPE_RE.test(value)) {
    throw new DeliveryVerifyError("Media type must be a token like application/gzip.");
  }
  return value;
}

export function normalizeMediaType(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const value = raw.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return value || null;
}

export const CANONICAL_DELIVERY_ACTOR = "nospoilers";

export function isSealedArtifactDigest(sha: string | null | undefined): boolean {
  return Boolean(sha && /^[a-f0-9]{64}$/i.test(sha));
}

export function publicGithubReleaseDownloadUrl(input: {
  owner: string;
  repo: string;
  tag: string;
  name: string;
}): string | null {
  const owner = input.owner.trim();
  const repo = input.repo.trim();
  const tag = input.tag.trim();
  const name = input.name.trim();
  if (!owner || !repo || !tag || !name) return null;
  if (/[\\/\s]/.test(owner) || /[\\/\s]/.test(repo)) return null;
  if (tag.includes("\\") || name.includes("\\") || tag.includes("..") || name.includes("..")) {
    return null;
  }
  const parsed = parseDeliveryUrl(
    `https://github.com/${owner}/${repo}/releases/download/${tag}/${name}`,
  );
  if (!parsed || !GITHUB_DOWNLOAD_HOSTS.has(parsed.host) || parsed.url.includes("?")) {
    return null;
  }
  return parsed.url;
}

export async function attachCanonicalDeliveryUrl(
  store: Store,
  input: {
    installationId: number;
    revisionId: number;
    url: string;
    createdByLogin?: string;
  },
): Promise<{ id: number } | null> {
  const parsed = parseDeliveryUrl(input.url);
  if (!parsed) return null;
  const existing = await store.listDeliveryLocationsForRevisions([input.revisionId]);
  const already = existing.find((row) => row.url === parsed.url);
  if (already) return { id: already.id };
  if (existing.length >= MAX_DELIVERY_LOCATIONS_PER_REVISION) return null;
  const installCount = await store.countDeliveryLocations({
    installationId: input.installationId,
  });
  if (installCount >= MAX_DELIVERY_LOCATIONS_PER_INSTALL) return null;
  const revision = await store.getReleaseRevision(input.revisionId);
  return store.insertDeliveryLocationIfAbsent({
    installationId: input.installationId,
    revisionId: input.revisionId,
    url: parsed.url,
    host: parsed.host,
    expectedMediaType: revision?.media_type ?? null,
    createdByLogin: input.createdByLogin ?? CANONICAL_DELIVERY_ACTOR,
  });
}

export function deliveryVerifyDeliveryId(locationId: number, atMs = Date.now()): string {
  return `delivery-verify:${locationId}:${Math.floor(atMs / 10_000)}`;
}

export async function enqueueDeliveryVerify(
  store: Store,
  input: { installationId: number; locationId: number; revisionId: number },
): Promise<{ queued: boolean }> {
  const result = await store.enqueueJob({
    deliveryId: deliveryVerifyDeliveryId(input.locationId),
    installationId: input.installationId,
    priority: "light",
    kind: DELIVERY_VERIFY_KIND,
    payload: {
      installationId: input.installationId,
      locationId: input.locationId,
      revisionId: input.revisionId,
    },
  });
  return { queued: result.inserted };
}

export async function verifyDeliveryUrl(input: {
  url: string;
  expectedSha256: string;
  expectedMediaType?: string | null;
  previousMediaType?: string | null;
  maxBytes?: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
  lookup?: WebhookHostLookup;
}): Promise<DeliveryVerifyResult> {
  const parsed = parseDeliveryUrl(input.url);
  if (!parsed) {
    return emptyResult("blocked", "Delivery URL host is not allowed.");
  }
  const lookup = input.lookup ?? lookupWebhookHost;
  const fetchImpl = input.fetch ?? fetch;
  const maxBytes = input.maxBytes ?? MAX_DELIVERY_BYTES;
  const timeoutMs = input.timeoutMs ?? DELIVERY_FETCH_TIMEOUT_MS;
  let current = parsed.url;
  let host = parsed.host;
  let redirects = 0;
  const hopHosts = [parsed.host];

  const finish = (
    status: DeliveryVerifyStatus,
    error: string | null,
    finalHost: string | null = host,
    redirectCount = redirects,
    extras: { cacheState?: string | null } = {},
  ): DeliveryVerifyResult => ({
    ...emptyResult(status, error, finalHost, redirectCount),
    redirectHosts: joinRedirectHosts(hopHosts),
    cacheState: extras.cacheState ?? null,
    deliveryRegion: parseDeliveryRegion(finalHost),
  });

  while (true) {
    const publicHost = await assertPublicWebhookHost(host, lookup);
    if (!publicHost) {
      return finish("blocked", "Delivery URL resolved to a private address.");
    }
    let response: Response;
    try {
      response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      return finish(
        "error",
        error instanceof Error ? error.message : "Delivery URL could not be fetched.",
      );
    }
    if (response.status === 404 || response.status === 410) {
      return finish("missing", `Delivery URL returned HTTP ${response.status}.`);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return finish("error", "Redirect was missing a Location header.");
      }
      let nextRaw: string;
      try {
        nextRaw = new URL(location, current).toString();
      } catch {
        return finish("blocked", "Redirect target is not a valid URL.");
      }
      const next = parseDeliveryUrl(nextRaw);
      if (!next) {
        return finish("blocked", "Redirect target host is not allowed.", host, redirects + 1);
      }
      hopHosts.push(next.host);
      if (next.host !== host && !isExpectedDeliveryRedirect(current, next.url)) {
        return finish(
          "redirect",
          `Delivery URL redirected from ${host} to ${next.host}. The other host was not fetched.`,
          next.host,
          redirects + 1,
        );
      }
      redirects += 1;
      if (redirects > MAX_DELIVERY_REDIRECTS) {
        return finish("error", "Delivery URL followed too many redirects.");
      }
      current = next.url;
      host = next.host;
      continue;
    }
    if (!response.ok) {
      return finish("error", `Delivery URL returned HTTP ${response.status}.`);
    }
    if (!response.body) {
      return finish("error", "Delivery URL returned no body.");
    }
    const sha256 = createHash("sha256");
    const sha512 = createHash("sha512");
    let bytes = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes) {
          await reader.cancel();
          return finish("error", "Delivery URL exceeded the streaming size limit.");
        }
        sha256.update(value);
        sha512.update(value);
      }
    } catch (error) {
      return finish(
        "error",
        error instanceof Error ? error.message : "Delivery URL stream failed.",
      );
    }
    const observedSha256 = sha256.digest("hex");
    const observedSha512 = sha512.digest("hex");
    const observedMediaType = normalizeMediaType(response.headers.get("content-type"));
    const expected = input.expectedSha256.toLowerCase();
    let status: DeliveryVerifyStatus = "matched";
    if (observedSha256 !== expected) status = "mismatch";
    else if (mediaTypeChanged(input.expectedMediaType, observedMediaType)) status = "content_type";
    else if (mediaTypeChanged(input.previousMediaType, observedMediaType)) status = "content_type";
    return {
      status,
      observedSha256,
      observedSha512,
      observedBytes: bytes,
      observedMediaType,
      finalHost: host,
      redirectCount: redirects,
      redirectHosts: joinRedirectHosts(hopHosts),
      cacheState: normalizeDeliveryCacheState(response.headers),
      deliveryRegion: parseDeliveryRegion(host),
      error: null,
    };
  }
}

function mediaTypeChanged(expected: string | null | undefined, observed: string | null): boolean {
  const want = normalizeMediaType(expected);
  const got = normalizeMediaType(observed);
  return Boolean(want && got && want !== got);
}

function emptyResult(
  status: DeliveryVerifyStatus,
  error: string | null,
  finalHost: string | null = null,
  redirectCount = 0,
): DeliveryVerifyResult {
  return {
    status,
    observedSha256: null,
    observedSha512: null,
    observedBytes: null,
    observedMediaType: null,
    finalHost,
    redirectCount,
    redirectHosts: finalHost,
    cacheState: null,
    deliveryRegion: parseDeliveryRegion(finalHost),
    error,
  };
}

export async function runDeliveryVerifyJob(input: {
  store: Store;
  notifier: AlertNotifier;
  installationId: number;
  locationId: number;
  revisionId: number;
  githubDeliveryId?: string | null;
  maxBytes?: number;
  fetch?: typeof fetch;
  lookup?: WebhookHostLookup;
}): Promise<void> {
  const location = await input.store.getDeliveryLocation(input.locationId);
  if (!location || location.installation_id !== input.installationId) return;
  if (location.revision_id !== input.revisionId) return;
  const revision = await input.store.getReleaseRevision(location.revision_id);
  if (!revision || revision.installation_id !== input.installationId) return;
  const previous = await input.store.latestDeliveryVerification(location.id);
  const result = await verifyDeliveryUrl({
    url: location.url,
    expectedSha256: revision.artifact_sha256,
    expectedMediaType: location.expected_media_type ?? revision.media_type,
    previousMediaType: previous?.observed_media_type ?? null,
    maxBytes: input.maxBytes,
    fetch: input.fetch,
    lookup: input.lookup,
  });
  await input.store.insertDeliveryVerification({
    installationId: location.installation_id,
    locationId: location.id,
    revisionId: revision.id,
    status: result.status,
    observedSha256: result.observedSha256,
    observedSha512: result.observedSha512,
    observedBytes: result.observedBytes,
    observedMediaType: result.observedMediaType,
    finalHost: result.finalHost,
    redirectCount: result.redirectCount,
    redirectHosts: result.redirectHosts,
    cacheState: result.cacheState,
    deliveryRegion: result.deliveryRegion,
    error: result.error,
  });
  if (result.status === "matched" || result.status === "blocked" || result.status === "error") {
    return;
  }
  const redacted = redactDeliveryUrl(location.url);
  const alert = alertForVerify(result, {
    coordinate: revision.coordinate,
    expectedSha256: revision.artifact_sha256,
    expectedBytes: revision.artifact_bytes,
    expectedMediaType: location.expected_media_type ?? revision.media_type,
    redacted,
    host: location.host,
  });
  if (!alert) return;
  await input.notifier.send({
    installationId: location.installation_id,
    repoId: revision.repo_id,
    repoFullName: null,
    kind: alert.kind,
    title: alert.title,
    body: alert.body,
    githubDeliveryId:
      input.githubDeliveryId ??
      `${alert.kind}:${location.id}:${result.observedSha256 ?? result.finalHost ?? result.status}`,
  });
}

function alertForVerify(
  result: DeliveryVerifyResult,
  input: {
    coordinate: string;
    expectedSha256: string;
    expectedBytes?: number | null;
    expectedMediaType?: string | null;
    redacted: string;
    host: string;
  },
): { kind: string; title: string; body: string } | null {
  if (result.status === "mismatch") {
    const sizeNote =
      input.expectedBytes != null && result.observedBytes != null
        ? ` Served ${result.observedBytes} bytes; sealed size is ${input.expectedBytes}.`
        : "";
    return {
      kind: "delivery_mismatch",
      title: `Delivery bytes changed for ${input.coordinate}`,
      body: `${input.redacted} served SHA-256 ${result.observedSha256}. The sealed revision is ${input.expectedSha256}.${sizeNote} Bytes were hashed in transit and not stored. This is a delivery fact, not a compromise claim.`,
    };
  }
  if (result.status === "missing") {
    return {
      kind: "delivery_missing",
      title: `Delivery URL missing for ${input.coordinate}`,
      body: `${input.redacted} is gone (${result.error ?? "HTTP 404/410"}). NoSpoilers did not download a replacement. This is a disappearance fact, not a compromise claim.`,
    };
  }
  if (result.status === "redirect") {
    return {
      kind: "delivery_redirect",
      title: `Delivery URL redirected off ${input.host}`,
      body: `${input.redacted} redirected to ${result.finalHost ?? "another host"}. The other host was not fetched. Query strings are not stored on Watch.`,
    };
  }
  if (result.status === "content_type") {
    return {
      kind: "delivery_content_type",
      title: `Delivery content-type changed for ${input.coordinate}`,
      body: `${input.redacted} served ${result.observedMediaType ?? "an unexpected type"}${
        input.expectedMediaType ? ` (sealed ${input.expectedMediaType})` : ""
      }. Digests still matched. This is a content-type fact, not a compromise claim.`,
    };
  }
  return null;
}
