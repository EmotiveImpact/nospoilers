import { isBlockedRegistryHost } from "./npm-registry.ts";
import type { Store } from "./store.ts";

export const RELEASE_CHANNELS = ["stable", "beta", "canary"] as const;
export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

const SOURCE_REVISION_RE = /^[A-Za-z0-9][A-Za-z0-9._/+@-]{0,199}$/;
const HOST_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export class ReleaseLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReleaseLedgerError";
  }
}

export function isReleaseChannel(value: string): value is ReleaseChannel {
  return (RELEASE_CHANNELS as readonly string[]).includes(value);
}

export function inferReleaseChannel(tagOrVersion: string | undefined | null): ReleaseChannel {
  const value = (tagOrVersion ?? "").trim().toLowerCase();
  if (!value) return "stable";
  if (/(?:^|[^a-z0-9])canary(?:[^a-z0-9]|$)/.test(value)) return "canary";
  if (
    /(?:^|[^a-z0-9])(?:beta|alpha|rc|pre|preview|next)(?:[^a-z0-9]|$)/.test(value) ||
    /(?:^|[-.])(?:rc|beta|alpha)\d/.test(value)
  ) {
    return "beta";
  }
  return "stable";
}

export function versionFromCoordinate(coordinate: string): string | undefined {
  if (coordinate.startsWith("github:")) {
    const at = coordinate.indexOf("@");
    if (at < 0) return undefined;
    const hash = coordinate.indexOf("#", at + 1);
    return coordinate.slice(at + 1, hash >= 0 ? hash : undefined) || undefined;
  }
  if (coordinate.startsWith("npm:")) {
    const rest = coordinate.slice(4);
    const at = rest.lastIndexOf("@");
    if (at <= 0) return undefined;
    return rest.slice(at + 1) || undefined;
  }
  return undefined;
}

export function inferReleaseChannelFromCoordinate(coordinate: string): ReleaseChannel {
  return inferReleaseChannel(versionFromCoordinate(coordinate));
}

export function parseReleaseChannel(raw: string | undefined | null): ReleaseChannel | undefined {
  if (raw == null || !raw.trim()) return undefined;
  const value = raw.trim().toLowerCase();
  if (!isReleaseChannel(value)) {
    throw new ReleaseLedgerError("Channel must be stable, beta, or canary.");
  }
  return value;
}

export function parseSourceRevision(raw: string | undefined | null): string | null {
  if (raw == null || !raw.trim()) return null;
  const value = raw.trim();
  if (value.length > 200 || !SOURCE_REVISION_RE.test(value)) {
    throw new ReleaseLedgerError("Source revision must be a git SHA, tag, or version.");
  }
  return value;
}

export function parseCiRunUrl(raw: string | undefined | null): string | null {
  if (raw == null || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (trimmed.length > 500) {
    throw new ReleaseLedgerError("CI run URL is too long.");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ReleaseLedgerError("CI run URL must be an https URL.");
  }
  if (url.protocol !== "https:") {
    throw new ReleaseLedgerError("CI run URL must be https.");
  }
  if (url.username || url.password) {
    throw new ReleaseLedgerError("CI run URL must not include credentials.");
  }
  const host = url.hostname.toLowerCase();
  if (!host || host.length > 253 || !HOST_RE.test(host) || isBlockedRegistryHost(host)) {
    throw new ReleaseLedgerError("CI run URL host is not allowed.");
  }
  url.hash = "";
  return url.toString();
}

export function parseReleaseScanMeta(input: {
  channel?: string | null;
  sourceRevision?: string | null;
  ciRunUrl?: string | null;
  coordinate: string;
}): {
  channel: ReleaseChannel;
  sourceRevision: string | null;
  ciRunUrl: string | null;
} {
  const channel =
    parseReleaseChannel(input.channel) ?? inferReleaseChannelFromCoordinate(input.coordinate);
  const sourceRevision =
    parseSourceRevision(input.sourceRevision) ?? versionFromCoordinate(input.coordinate) ?? null;
  return {
    channel,
    sourceRevision,
    ciRunUrl: parseCiRunUrl(input.ciRunUrl),
  };
}

export async function appendReleaseRevision(
  store: Store,
  input: {
    installationId: number;
    packageId?: number | null;
    repoId?: number | null;
    receiptId: number;
    channel: ReleaseChannel;
    coordinate: string;
    artifactSha256: string;
    artifactSha512?: string | null;
    sourceRevision?: string | null;
    ciRunUrl?: string | null;
  },
) {
  const sha256 = input.artifactSha256.toLowerCase();
  const previous = await store.latestReleaseRevision(
    input.installationId,
    input.coordinate,
    input.channel,
  );
  const previousSha256 = previous?.artifact_sha256 ?? null;
  const mismatch = previousSha256 !== null && previousSha256 !== sha256;
  const row = await store.insertReleaseRevision({
    installationId: input.installationId,
    packageId: input.packageId ?? null,
    repoId: input.repoId ?? null,
    receiptId: input.receiptId,
    channel: input.channel,
    coordinate: input.coordinate,
    artifactSha256: sha256,
    artifactSha512: input.artifactSha512 ? input.artifactSha512.toLowerCase() : null,
    sourceRevision: input.sourceRevision ?? null,
    ciRunUrl: input.ciRunUrl ?? null,
    previousSha256,
    mismatch,
  });
  if (mismatch) {
    await store.insertAlert({
      installationId: input.installationId,
      repoId: input.repoId ?? null,
      kind: "release_digest_mismatch",
      title: `Digest mismatch on ${input.coordinate} (${input.channel})`,
      body: `Previous SHA-256 ${previousSha256}. This artifact is ${sha256}. Historical revisions were not rewritten. A digest change is not a compromise claim.`,
      findings: {
        coordinate: input.coordinate,
        channel: input.channel,
        previousSha256,
        artifactSha256: sha256,
      },
    });
  }
  return row;
}
