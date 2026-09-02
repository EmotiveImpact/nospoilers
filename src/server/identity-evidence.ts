import { coverageFrom, type Coverage } from "../coverage.ts";
import { mintPublicToken, parsePublicToken } from "./release-public.ts";
import type {
  IdentityCandidateRow,
  PackageIdentitySnapshotRow,
  PackageProtectionRow,
} from "./store.ts";

export const MAX_ADVISORY_PAGES_PER_INSTALL = 40;
export const MAX_EVIDENCE_ALERTS = 40;
export const PUBLIC_ADVISORY_PATH_PREFIX = "/advisory/";
export const ADVISORY_CAP_ERROR = `At most ${MAX_ADVISORY_PAGES_PER_INSTALL} published consumer advisories on this install.`;
export const ADVISORY_ALREADY_ERROR = "That package already has a published consumer advisory.";
export const ADVISORY_MISSING_ERROR = "That package does not have a published consumer advisory.";
export const ADVISORY_UNKNOWN_ERROR = "Unknown consumer advisory.";
export const EVIDENCE_UNPAID_ERROR =
  "Coverage ended. Subscribe to Team for identity evidence and consumer advisories.";
export const EVIDENCE_SOLO_ERROR = "Identity evidence and consumer advisories are on Team.";
export const EVIDENCE_UNPROTECTED_ERROR = "Protect this package before assembling evidence.";
export const EVIDENCE_MISSING_ERROR = "Assemble identity evidence before publishing an advisory.";
export const EVIDENCE_NOT_MALWARE =
  "Facts about this package identity. Not a malware verdict. Not an automatic takedown.";

export const IDENTITY_EVIDENCE_ALERT_KINDS = [
  "package_maintainer_changed",
  "package_repository_mismatch",
  "package_homepage_mismatch",
  "package_shape_anomaly",
  "package_publisher_changed",
  "package_unpublished",
  "identity_lookalike_registered",
  "identity_lookalike_version",
  "identity_dormant",
  "identity_burst",
  "identity_jump",
  "identity_new_dependency",
  "identity_size_jump",
  "identity_provenance_lost",
  "identity_provenance_changed",
  "identity_signature_changed",
] as const;

export type IdentityEvidenceAlertKind = (typeof IDENTITY_EVIDENCE_ALERT_KINDS)[number];

export type EvidenceLookalike = {
  name: string;
  transformation: string;
  lastVersion: string | null;
  registeredAt: string | null;
  allowlisted: boolean;
};

export type EvidenceAlertFact = {
  kind: string;
  title: string;
};

export type EvidenceRegistryContact = {
  host: string;
  path: string;
  note: string;
};

export type IdentityEvidencePayload = {
  packageName: string;
  version: string | null;
  maintainers: string[];
  publisherName: string | null;
  trustedPublisher: string | null;
  repositoryUrl: string | null;
  homepage: string | null;
  repositoryHost: string | null;
  homepageHost: string | null;
  verifiedVia: "scope_match" | "github_repository" | null;
  githubRepo: string | null;
  binNames: string[];
  lifecycleScripts: string[];
  unpackedBytes: number | null;
  hasAttestations: boolean | null;
  attestationPredicate: string | null;
  signatureKeyids: string[];
  lookalikes: EvidenceLookalike[];
  alerts: EvidenceAlertFact[];
  assembledAt: string;
  assembledByLogin: string;
  malwareVerdict: false;
  sent: false;
  registryContact: {
    npm: EvidenceRegistryContact;
    github: EvidenceRegistryContact;
  };
};

export type PublicAdvisoryView = {
  path: string;
  packageName: string;
  repositoryHost: string | null;
  homepageHost: string | null;
  lookalikes: Array<{ name: string; transformation: string }>;
  assembledAt: string;
  malwareVerdict: false;
  sent: false;
  disclaimer: string;
};

export type IdentityEvidenceSummary = {
  packageName: string;
  assembledAt: string;
  advisory: { enabled: boolean; path: string | null };
  sent: false;
  malwareVerdict: false;
  takedown: IdentityEvidencePayload;
};

const ADVISORY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

const REGISTRY_CONTACT = {
  npm: {
    host: "www.npmjs.com",
    path: "/support",
    note: "Copy this evidence package into npm support. NoSpoilers does not send it.",
  },
  github: {
    host: "support.github.com",
    path: "/",
    note: "Copy this evidence package into GitHub support. NoSpoilers does not send it.",
  },
} as const;

export function identityEvidencePlanDenied(
  coverage: Coverage,
): { error: string; status: 402 | 403 } | null {
  if (coverage.status === "ended") {
    return { error: EVIDENCE_UNPAID_ERROR, status: 402 };
  }
  if (coverage.plan === "solo") {
    return { error: EVIDENCE_SOLO_ERROR, status: 403 };
  }
  return null;
}

export function identityEvidencePlanDeniedFromBilling(
  trialEndsAt: string | Date | null | undefined,
  plan: string | null | undefined,
): { error: string; status: 402 | 403 } | null {
  return identityEvidencePlanDenied(coverageFrom(trialEndsAt, plan));
}

export function isIdentityEvidenceAlertKind(kind: string): kind is IdentityEvidenceAlertKind {
  return (IDENTITY_EVIDENCE_ALERT_KINDS as readonly string[]).includes(kind);
}

export function publicHostFromUrl(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  let cleaned = raw.trim().replace(/^git\+/, "");
  if (cleaned.startsWith("git@")) {
    const colon = cleaned.indexOf(":");
    const host = (colon > 4 ? cleaned.slice(4, colon) : "").toLowerCase();
    return host && host !== "localhost" ? host : null;
  }
  try {
    const url = new URL(cleaned.includes("://") ? cleaned : `https://${cleaned}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host === "localhost") return null;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

export function publicAdvisoryPath(token: string): string {
  return `${PUBLIC_ADVISORY_PATH_PREFIX}${token}`;
}

export function parseAdvisoryToken(raw: string): string | null {
  const token = parsePublicToken(raw);
  if (token) return token;
  const trimmed = raw.trim();
  if (!ADVISORY_TOKEN_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function mintAdvisoryToken(): string {
  return mintPublicToken();
}

export function advisorySummary(page: { enabled: boolean; public_token: string } | null): {
  enabled: boolean;
  path: string | null;
} {
  if (!page) return { enabled: false, path: null };
  return {
    enabled: page.enabled,
    path: page.enabled ? publicAdvisoryPath(page.public_token) : null,
  };
}

function cleanNameList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const names = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const name = value.trim();
    if (!name || name.includes("@") && name.includes(".")) continue;
    if (name.includes("://") || name.includes("?")) continue;
    names.add(name);
  }
  return [...names];
}

function cleanText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  return value;
}

export function assembleIdentityEvidence(input: {
  packageName: string;
  actorLogin: string;
  protection: PackageProtectionRow | null;
  snapshot: PackageIdentitySnapshotRow | null;
  candidates: IdentityCandidateRow[];
  alerts: Array<{ kind: string; title: string }>;
  assembledAt?: string;
}): IdentityEvidencePayload {
  const snapshot = input.snapshot;
  const lookalikes = input.candidates
    .filter((row) => row.registered_at)
    .map((row) => ({
      name: row.candidate_name,
      transformation: row.transformation,
      lastVersion: row.last_version,
      registeredAt: row.registered_at,
      allowlisted: Boolean(row.allowlisted_at),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const alerts = input.alerts
    .filter((row) => isIdentityEvidenceAlertKind(row.kind) && row.title.includes(input.packageName))
    .slice(0, MAX_EVIDENCE_ALERTS)
    .map((row) => ({ kind: row.kind, title: row.title }));
  return {
    packageName: input.packageName,
    version: snapshot?.version ?? null,
    maintainers: cleanNameList(snapshot?.maintainers ?? []),
    publisherName: cleanText(snapshot?.publisher_name ?? null),
    trustedPublisher: cleanText(snapshot?.trusted_publisher ?? null),
    repositoryUrl: cleanText(snapshot?.repository_url ?? null),
    homepage: cleanText(snapshot?.homepage ?? null),
    repositoryHost: publicHostFromUrl(snapshot?.repository_url ?? null),
    homepageHost: publicHostFromUrl(snapshot?.homepage ?? null),
    verifiedVia: input.protection?.verified_via ?? null,
    githubRepo: cleanText(input.protection?.github_repo ?? null),
    binNames: cleanNameList(snapshot?.bin_names ?? []),
    lifecycleScripts: cleanNameList(snapshot?.lifecycle_scripts ?? []),
    unpackedBytes: snapshot?.unpacked_bytes ?? null,
    hasAttestations: snapshot?.has_attestations ?? null,
    attestationPredicate: cleanText(snapshot?.attestation_predicate ?? null),
    signatureKeyids: cleanNameList(snapshot?.signature_keyids ?? []),
    lookalikes,
    alerts,
    assembledAt: input.assembledAt ?? new Date().toISOString(),
    assembledByLogin: input.actorLogin,
    malwareVerdict: false,
    sent: false,
    registryContact: {
      npm: { ...REGISTRY_CONTACT.npm },
      github: { ...REGISTRY_CONTACT.github },
    },
  };
}

export function parseStoredEvidencePayload(raw: unknown): IdentityEvidencePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const packageName = cleanText(row.packageName);
  if (!packageName) return null;
  const lookalikes = Array.isArray(row.lookalikes)
    ? row.lookalikes.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        const name = cleanText(item.name);
        const transformation = cleanText(item.transformation);
        if (!name || !transformation) return [];
        return [
          {
            name,
            transformation,
            lastVersion: cleanText(item.lastVersion),
            registeredAt: cleanText(item.registeredAt),
            allowlisted: item.allowlisted === true,
          },
        ];
      })
    : [];
  const alerts = Array.isArray(row.alerts)
    ? row.alerts.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        const kind = cleanText(item.kind);
        const title = cleanText(item.title);
        if (!kind || !title || !isIdentityEvidenceAlertKind(kind)) return [];
        return [{ kind, title }];
      })
    : [];
  return {
    packageName,
    version: cleanText(row.version),
    maintainers: cleanNameList(row.maintainers),
    publisherName: cleanText(row.publisherName),
    trustedPublisher: cleanText(row.trustedPublisher),
    repositoryUrl: cleanText(row.repositoryUrl),
    homepage: cleanText(row.homepage),
    repositoryHost: publicHostFromUrl(cleanText(row.repositoryHost) ?? cleanText(row.repositoryUrl)),
    homepageHost: publicHostFromUrl(cleanText(row.homepageHost) ?? cleanText(row.homepage)),
    verifiedVia:
      row.verifiedVia === "scope_match" || row.verifiedVia === "github_repository"
        ? row.verifiedVia
        : null,
    githubRepo: cleanText(row.githubRepo),
    binNames: cleanNameList(row.binNames),
    lifecycleScripts: cleanNameList(row.lifecycleScripts),
    unpackedBytes: typeof row.unpackedBytes === "number" && Number.isFinite(row.unpackedBytes)
      ? row.unpackedBytes
      : null,
    hasAttestations:
      row.hasAttestations === true ? true : row.hasAttestations === false ? false : null,
    attestationPredicate: cleanText(row.attestationPredicate),
    signatureKeyids: cleanNameList(row.signatureKeyids),
    lookalikes,
    alerts,
    assembledAt: cleanText(row.assembledAt) ?? new Date().toISOString(),
    assembledByLogin: cleanText(row.assembledByLogin) ?? "",
    malwareVerdict: false,
    sent: false,
    registryContact: {
      npm: { ...REGISTRY_CONTACT.npm },
      github: { ...REGISTRY_CONTACT.github },
    },
  };
}

export function buildPublicAdvisoryView(input: {
  token: string;
  payload: IdentityEvidencePayload;
}): PublicAdvisoryView {
  return {
    path: publicAdvisoryPath(input.token),
    packageName: input.payload.packageName,
    repositoryHost: input.payload.repositoryHost,
    homepageHost: input.payload.homepageHost,
    lookalikes: input.payload.lookalikes.map((row) => ({
      name: row.name,
      transformation: row.transformation,
    })),
    assembledAt: input.payload.assembledAt,
    malwareVerdict: false,
    sent: false,
    disclaimer: EVIDENCE_NOT_MALWARE,
  };
}

export function buildEvidenceSummary(input: {
  enabled: boolean;
  token: string;
  payload: IdentityEvidencePayload;
}): IdentityEvidenceSummary {
  return {
    packageName: input.payload.packageName,
    assembledAt: input.payload.assembledAt,
    advisory: advisorySummary({ enabled: input.enabled, public_token: input.token }),
    sent: false,
    malwareVerdict: false,
    takedown: input.payload,
  };
}

export function advisoryViewLeaksSecrets(view: PublicAdvisoryView): boolean {
  const blob = JSON.stringify(view);
  return (
    blob.includes("?") ||
    blob.includes("://") ||
    blob.includes("ns1.") ||
    blob.includes("nsp_") ||
    blob.includes("tarball") ||
    /postgres(?:ql)?:\/\//i.test(blob) ||
    /routingKey|receiptBody|ciRunUrl|installationId|alertBody/i.test(blob) ||
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(blob)
  );
}
