import { coverageFrom, type Coverage } from "../coverage.ts";
import { PUBLIC_NPM_HOST, PUBLIC_NPM_ORIGIN, parseRegistryOrigin } from "./npm-registry.ts";
import type { GithubPort } from "./github.ts";
import type { ReleaseRevisionRow, Store } from "./store.ts";

export const ATTESTATION_SOURCES = ["github", "npm"] as const;
export type AttestationSource = (typeof ATTESTATION_SOURCES)[number];

export const ATTESTATION_STATUSES = [
  "missing",
  "present",
  "subject_mismatch",
  "unreadable",
] as const;
export type AttestationStatus = (typeof ATTESTATION_STATUSES)[number];

export const ATTESTATION_UNPAID_ERROR =
  "Coverage ended. Subscribe to Team to refresh GitHub and npm attestations.";
export const ATTESTATION_SOLO_ERROR = "GitHub and npm attestation adapters are on Team.";
export const ATTESTATION_NO_SOURCE_ERROR =
  "This release has no GitHub repository or npm coordinate to check.";
export const ATTESTATION_NOT_MALWARE =
  "Facts about attestation documents for this digest. Not a signature verdict and not a compromise claim.";

export const MAX_ATTESTATION_PREDICATE = 200;
export const MAX_ATTESTATION_BUILDER = 300;
export const MAX_ATTESTATION_ISSUER = 200;
export const MAX_NPM_ATTESTATION_BYTES = 256 * 1024;

export type AttestationFacts = {
  source: AttestationSource;
  status: AttestationStatus;
  predicateType: string | null;
  subjectDigest: string | null;
  builderId: string | null;
  issuer: string | null;
};

export type ReleaseAttestationRow = {
  id: number;
  installation_id: number;
  revision_id: number;
  source: AttestationSource;
  status: AttestationStatus;
  predicate_type: string | null;
  subject_digest: string | null;
  builder_id: string | null;
  issuer: string | null;
  created_at: string;
};

export type AttestationChange =
  | { kind: "lost"; source: AttestationSource }
  | { kind: "changed"; source: AttestationSource }
  | { kind: "mismatch"; source: AttestationSource };

export function attestationPlanDenied(
  coverage: Coverage,
): { error: string; status: 402 | 403 } | null {
  if (coverage.status === "ended") {
    return { error: ATTESTATION_UNPAID_ERROR, status: 402 };
  }
  if (coverage.plan === "solo") {
    return { error: ATTESTATION_SOLO_ERROR, status: 403 };
  }
  return null;
}

export function attestationPlanDeniedFromBilling(
  trialEndsAt: string | Date | null | undefined,
  plan: string | null | undefined,
): { error: string; status: 402 | 403 } | null {
  return attestationPlanDenied(coverageFrom(trialEndsAt, plan));
}

export function normalizeArtifactDigest(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const value = raw.trim().toLowerCase().replace(/^sha256:/, "");
  if (!/^[0-9a-f]{64}$/.test(value)) return null;
  return value;
}

export function githubRepoFromReleaseCoordinate(coordinate: string): {
  owner: string;
  name: string;
} | null {
  if (!coordinate.startsWith("github:")) return null;
  const rest = coordinate.slice("github:".length);
  const at = rest.indexOf("@");
  const full = (at >= 0 ? rest.slice(0, at) : rest).trim();
  const parts = full.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const name = parts[1].replace(/\.git$/i, "");
  if (!owner || !name) return null;
  return { owner, name };
}

export function npmNameVersionFromCoordinate(coordinate: string): {
  name: string;
  version: string;
} | null {
  if (!coordinate.startsWith("npm:")) return null;
  const rest = coordinate.slice(4).trim();
  if (rest.startsWith("@")) {
    const at = rest.indexOf("@", 1);
    if (at <= 1) return null;
    const name = rest.slice(0, at).trim();
    const version = rest.slice(at + 1).trim();
    if (!name || !version || version.includes("@")) return null;
    return { name, version };
  }
  const at = rest.lastIndexOf("@");
  if (at <= 0) return null;
  const name = rest.slice(0, at).trim();
  const version = rest.slice(at + 1).trim();
  if (!name || !version) return null;
  return { name, version };
}

export function publicNpmAttestationUrl(name: string, version: string): string {
  return `${PUBLIC_NPM_ORIGIN}/-/npm/v1/attestations/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

export function isPublicNpmAttestationUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.hostname.toLowerCase() !== PUBLIC_NPM_HOST) return false;
  return url.pathname.startsWith("/-/npm/v1/attestations/");
}

export function asAttestationSource(value: string | null | undefined): AttestationSource | null {
  return value === "github" || value === "npm" ? value : null;
}

export function asAttestationStatus(value: string | null | undefined): AttestationStatus | null {
  return value === "missing" ||
    value === "present" ||
    value === "subject_mismatch" ||
    value === "unreadable"
    ? value
    : null;
}

export function emptyAttestationFacts(source: AttestationSource): AttestationFacts {
  return {
    source,
    status: "missing",
    predicateType: null,
    subjectDigest: null,
    builderId: null,
    issuer: null,
  };
}

function cleanShort(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > max) return null;
  if (value.includes("\n") || value.includes("\0")) return null;
  return value;
}

function decodeDssePayload(payload: unknown): unknown | null {
  if (typeof payload !== "string" || !payload.trim()) return null;
  const trimmed = payload.trim();
  for (const encoding of ["base64", "base64url"] as const) {
    try {
      const json = Buffer.from(trimmed, encoding).toString("utf8");
      if (!json.startsWith("{")) continue;
      return JSON.parse(json) as unknown;
    } catch {
      continue;
    }
  }
  return null;
}

function subjectDigestFromStatement(statement: Record<string, unknown>): string | null {
  const subjects = statement.subject;
  if (!Array.isArray(subjects)) return null;
  for (const entry of subjects) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const digest = (entry as { digest?: unknown }).digest;
    if (!digest || typeof digest !== "object" || Array.isArray(digest)) continue;
    const sha256 = (digest as { sha256?: unknown }).sha256;
    const normalized = normalizeArtifactDigest(typeof sha256 === "string" ? sha256 : null);
    if (normalized) return normalized;
  }
  return null;
}

function builderFromPredicate(predicate: unknown): { builderId: string | null; issuer: string | null } {
  if (!predicate || typeof predicate !== "object" || Array.isArray(predicate)) {
    return { builderId: null, issuer: null };
  }
  const record = predicate as Record<string, unknown>;
  const runDetails = record.runDetails;
  if (runDetails && typeof runDetails === "object" && !Array.isArray(runDetails)) {
    const builder = (runDetails as { builder?: unknown }).builder;
    if (builder && typeof builder === "object" && !Array.isArray(builder)) {
      const id = cleanShort((builder as { id?: unknown }).id, MAX_ATTESTATION_BUILDER);
      if (id) return { builderId: id, issuer: issuerFromBuilderId(id) };
    }
  }
  const builder = record.builder;
  if (builder && typeof builder === "object" && !Array.isArray(builder)) {
    const id = cleanShort((builder as { id?: unknown }).id, MAX_ATTESTATION_BUILDER);
    if (id) return { builderId: id, issuer: issuerFromBuilderId(id) };
  }
  const definition = record.buildDefinition;
  if (definition && typeof definition === "object" && !Array.isArray(definition)) {
    const external = (definition as { externalParameters?: unknown }).externalParameters;
    if (external && typeof external === "object" && !Array.isArray(external)) {
      const workflow = (external as { workflow?: unknown }).workflow;
      if (workflow && typeof workflow === "object" && !Array.isArray(workflow)) {
        const repository = cleanShort(
          (workflow as { repository?: unknown }).repository,
          MAX_ATTESTATION_BUILDER,
        );
        if (repository) return { builderId: repository, issuer: "github" };
      }
    }
  }
  return { builderId: null, issuer: null };
}

function issuerFromBuilderId(id: string): string | null {
  try {
    const host = new URL(id).hostname.toLowerCase();
    if (!host || host.length > 253) return null;
    return cleanShort(host, MAX_ATTESTATION_ISSUER);
  } catch {
    return null;
  }
}

function envelopeFromUnknown(raw: unknown): unknown | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.dsseEnvelope) return record.dsseEnvelope;
  if (record.payload && record.payloadType) return record;
  if (record.bundle) return envelopeFromUnknown(record.bundle);
  return record;
}

export function factsFromAttestationDocument(
  source: AttestationSource,
  raw: unknown,
  expectedSha256: string,
): AttestationFacts {
  const expected = normalizeArtifactDigest(expectedSha256);
  const empty = emptyAttestationFacts(source);
  if (!expected) return { ...empty, status: "unreadable" };
  const attestations = Array.isArray((raw as { attestations?: unknown })?.attestations)
    ? ((raw as { attestations: unknown[] }).attestations)
    : Array.isArray(raw)
      ? raw
      : raw
        ? [raw]
        : [];
  if (attestations.length === 0) return empty;

  let sawUnreadable = false;
  let mismatch: AttestationFacts | null = null;
  for (const entry of attestations) {
    const envelope = envelopeFromUnknown(entry);
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
      sawUnreadable = true;
      continue;
    }
    const payload = decodeDssePayload((envelope as { payload?: unknown }).payload);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      sawUnreadable = true;
      continue;
    }
    const statement = payload as Record<string, unknown>;
    const predicateType = cleanShort(statement.predicateType, MAX_ATTESTATION_PREDICATE);
    const subjectDigest = subjectDigestFromStatement(statement);
    const { builderId, issuer } = builderFromPredicate(statement.predicate);
    if (!subjectDigest || !predicateType) {
      sawUnreadable = true;
      continue;
    }
    const facts: AttestationFacts = {
      source,
      status: subjectDigest === expected ? "present" : "subject_mismatch",
      predicateType,
      subjectDigest,
      builderId,
      issuer,
    };
    if (facts.status === "present") return facts;
    mismatch ??= facts;
  }
  if (mismatch) return mismatch;
  if (sawUnreadable) return { ...empty, status: "unreadable" };
  return empty;
}

export function diffAttestationFacts(
  previous: AttestationFacts | null,
  next: AttestationFacts,
): AttestationChange[] {
  if (!previous) return [];
  if (previous.status === "present" && next.status === "missing") {
    return [{ kind: "lost", source: next.source }];
  }
  if (previous.status === "present" && next.status === "subject_mismatch") {
    return [{ kind: "mismatch", source: next.source }];
  }
  if (previous.status === "present" && next.status === "unreadable") {
    return [{ kind: "changed", source: next.source }];
  }
  if (
    previous.status === "present" &&
    next.status === "present" &&
    ((previous.predicateType ?? "") !== (next.predicateType ?? "") ||
      (previous.builderId ?? "") !== (next.builderId ?? ""))
  ) {
    return [{ kind: "changed", source: next.source }];
  }
  return [];
}

export function publicAttestation(row: ReleaseAttestationRow) {
  return {
    source: row.source,
    status: row.status,
    predicateType: row.predicate_type,
    subjectDigest: row.subject_digest,
    builderId: row.builder_id,
    issuer: row.issuer,
    createdAt: row.created_at,
  };
}

export function latestAttestationBySource(
  rows: ReleaseAttestationRow[],
): Map<AttestationSource, ReleaseAttestationRow> {
  const latest = new Map<AttestationSource, ReleaseAttestationRow>();
  for (const row of rows) {
    const current = latest.get(row.source);
    if (!current || row.id > current.id) latest.set(row.source, row);
  }
  return latest;
}

export function rowToFacts(row: ReleaseAttestationRow): AttestationFacts {
  return {
    source: row.source,
    status: row.status,
    predicateType: row.predicate_type,
    subjectDigest: row.subject_digest,
    builderId: row.builder_id,
    issuer: row.issuer,
  };
}

function alertCopy(
  change: AttestationChange,
  coordinate: string,
): { kind: string; title: string; body: string } {
  const source = change.source === "github" ? "GitHub" : "npm";
  if (change.kind === "lost") {
    return {
      kind: "release_attestation_lost",
      title: `${source} attestation disappeared on ${coordinate}`,
      body: `${source} no longer publishes an attestation document for this sealed digest. ${ATTESTATION_NOT_MALWARE}`,
    };
  }
  if (change.kind === "mismatch") {
    return {
      kind: "release_attestation_mismatch",
      title: `${source} attestation subject mismatch on ${coordinate}`,
      body: `${source} returned an attestation whose subject digest is not this sealed revision. ${ATTESTATION_NOT_MALWARE}`,
    };
  }
  return {
    kind: "release_attestation_changed",
    title: `${source} attestation changed on ${coordinate}`,
    body: `${source} published a different attestation predicate or builder for this sealed digest. ${ATTESTATION_NOT_MALWARE}`,
  };
}

async function githubFacts(
  github: GithubPort,
  installationId: number,
  repo: { owner: string; name: string },
  sha256: string,
): Promise<AttestationFacts> {
  if (!github.listAttestations) return emptyAttestationFacts("github");
  try {
    const raw = await github.listAttestations(installationId, repo.owner, repo.name, sha256);
    return factsFromAttestationDocument("github", raw, sha256);
  } catch {
    return { ...emptyAttestationFacts("github"), status: "unreadable" };
  }
}

export async function fetchPublicNpmAttestationFacts(
  name: string,
  version: string,
  sha256: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AttestationFacts> {
  const url = publicNpmAttestationUrl(name, version);
  if (!isPublicNpmAttestationUrl(url)) return emptyAttestationFacts("npm");
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json", "User-Agent": "NoSpoilers" },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 404) return emptyAttestationFacts("npm");
    if (!response.ok) return { ...emptyAttestationFacts("npm"), status: "unreadable" };
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_NPM_ATTESTATION_BYTES) {
      return { ...emptyAttestationFacts("npm"), status: "unreadable" };
    }
    const text = await response.text();
    if (text.length > MAX_NPM_ATTESTATION_BYTES) {
      return { ...emptyAttestationFacts("npm"), status: "unreadable" };
    }
    let body: unknown = text;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      return { ...emptyAttestationFacts("npm"), status: "unreadable" };
    }
    return factsFromAttestationDocument("npm", body, sha256);
  } catch {
    return { ...emptyAttestationFacts("npm"), status: "unreadable" };
  }
}

export async function resolveAttestationTargets(
  store: Store,
  revision: ReleaseRevisionRow,
): Promise<{
  github: { owner: string; name: string } | null;
  npm: { name: string; version: string; origin: string } | null;
}> {
  let github = githubRepoFromReleaseCoordinate(revision.coordinate);
  if (!github && revision.repo_id) {
    const repo = await store.getRepo(revision.repo_id);
    if (repo?.owner && repo.name) github = { owner: repo.owner, name: repo.name };
  }
  const npm = npmNameVersionFromCoordinate(revision.coordinate);
  let origin = PUBLIC_NPM_ORIGIN;
  if (npm && revision.package_id) {
    const pkg = await store.getWatchedPackage(revision.package_id);
    const parsed = pkg?.registry_origin ? parseRegistryOrigin(pkg.registry_origin) : null;
    if (parsed) origin = parsed.origin;
  }
  return {
    github,
    npm: npm ? { ...npm, origin } : null,
  };
}

export async function refreshReleaseAttestations(input: {
  store: Store;
  github: GithubPort;
  revision: ReleaseRevisionRow;
  actorLogin: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  rows: ReleaseAttestationRow[];
  changes: AttestationChange[];
}> {
  const expected = normalizeArtifactDigest(input.revision.artifact_sha256);
  if (!expected) {
    throw Object.assign(new Error("Sealed digest is not a SHA-256."), { status: 400 });
  }
  const targets = await resolveAttestationTargets(input.store, input.revision);
  if (!targets.github && !targets.npm) {
    throw Object.assign(new Error(ATTESTATION_NO_SOURCE_ERROR), { status: 400 });
  }
  const previousRows = await input.store.listReleaseAttestationsForRevisions([input.revision.id]);
  const previous = latestAttestationBySource(previousRows);
  const nextFacts: AttestationFacts[] = [];
  if (targets.github) {
    nextFacts.push(
      await githubFacts(
        input.github,
        input.revision.installation_id,
        targets.github,
        expected,
      ),
    );
  }
  if (targets.npm && targets.npm.origin === PUBLIC_NPM_ORIGIN) {
    nextFacts.push(
      await fetchPublicNpmAttestationFacts(
        targets.npm.name,
        targets.npm.version,
        expected,
        input.fetchImpl ?? fetch,
      ),
    );
  } else if (targets.npm) {
    nextFacts.push(emptyAttestationFacts("npm"));
  }

  const inserted: ReleaseAttestationRow[] = [];
  const changes: AttestationChange[] = [];
  for (const facts of nextFacts) {
    const prior = previous.get(facts.source) ?? null;
    changes.push(...diffAttestationFacts(prior ? rowToFacts(prior) : null, facts));
    inserted.push(
      await input.store.insertReleaseAttestation({
        installationId: input.revision.installation_id,
        revisionId: input.revision.id,
        source: facts.source,
        status: facts.status,
        predicateType: facts.predicateType,
        subjectDigest: facts.subjectDigest,
        builderId: facts.builderId,
        issuer: facts.issuer,
      }),
    );
  }

  for (const change of changes) {
    const copy = alertCopy(change, input.revision.coordinate);
    await input.store.insertAlert({
      installationId: input.revision.installation_id,
      repoId: input.revision.repo_id,
      kind: copy.kind,
      title: copy.title,
      body: copy.body,
      findings: { source: change.source, kind: change.kind, actor: input.actorLogin },
    });
  }

  return { rows: inserted, changes };
}
