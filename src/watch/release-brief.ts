import type { ReleaseRevision } from "./types.ts";

export type ReleaseProofTone = "clean" | "blocked" | "waiting" | "not-configured";

export type ReleaseProofStep = {
  key: "artifact" | "identity" | "delivery" | "governance";
  label: string;
  summary: string;
  status: string;
  tone: ReleaseProofTone;
  applicable: boolean;
  evidenceLabel: string;
  evidence: string;
};

export type ReleaseBriefModel = {
  blocked: boolean;
  ready: boolean;
  title: string;
  detail: string;
  status: "blocked" | "ready" | "pending";
  applicableChecks: number;
  cleanChecks: number;
  steps: ReleaseProofStep[];
};

const BAD_DELIVERY_STATES = new Set([
  "mismatch",
  "missing",
  "content_type",
  "blocked",
  "error",
  "redirect",
]);

export function buildReleaseBriefModel(release: ReleaseRevision): ReleaseBriefModel {
  const artifactBlocked =
    release.mismatch ||
    release.receiptStatus === "failed-policy" ||
    release.receiptStatus === "inconclusive";
  const artifactClean = release.receiptStatus === "passed" && !release.mismatch;

  const attestations = release.attestations ?? [];
  const identityApplicable = attestations.length > 0;
  const identityBlocked = attestations.some(
    (row) => row.status === "subject_mismatch" || row.status === "unreadable",
  );
  const identityClean = identityApplicable && attestations.every((row) => row.status === "present");

  const locations = release.locations ?? [];
  const deliveryApplicable = locations.length > 0;
  const deliveryBlocked = locations.some(
    (row) => row.lastStatus && BAD_DELIVERY_STATES.has(row.lastStatus),
  );
  const deliveryClean =
    deliveryApplicable && locations.every((row) => row.lastStatus === "matched");

  const governanceApplicable = Boolean(release.approval || release.legalHold);
  const governanceBlocked =
    Boolean(release.legalHold?.active) || release.approval?.decision === "rejected";
  const governanceClean = release.approval?.decision === "approved" && !release.legalHold?.active;

  const steps: ReleaseProofStep[] = [
    {
      key: "artifact",
      label: "Artifact scanned",
      summary: "Packed bytes and policy findings",
      status: artifactBlocked
        ? release.mismatch
          ? "Digest changed"
          : release.receiptStatus === "inconclusive"
            ? "Inconclusive"
            : "Failed policy"
        : artifactClean
          ? "Clean"
          : "Waiting",
      tone: artifactBlocked ? "blocked" : artifactClean ? "clean" : "waiting",
      applicable: true,
      evidenceLabel: "Artifact evidence",
      evidence: artifactBlocked
        ? release.mismatch
          ? "The observed artifact digest no longer matches the sealed receipt."
          : "The signed receipt does not support a clean release decision."
        : artifactClean
          ? `A passing receipt covers sha256 ${release.artifactSha256}.`
          : "No completed signed receipt is attached to this revision yet.",
    },
    {
      key: "identity",
      label: "Source identity",
      summary: "GitHub or registry attestation",
      status: !identityApplicable
        ? "Not recorded"
        : identityBlocked
          ? "Mismatch"
          : identityClean
            ? "Verified"
            : "Waiting",
      tone: !identityApplicable
        ? "not-configured"
        : identityBlocked
          ? "blocked"
          : identityClean
            ? "clean"
            : "waiting",
      applicable: identityApplicable,
      evidenceLabel: "Identity evidence",
      evidence: !identityApplicable
        ? "No source attestation is recorded for this revision. It is not counted as a required check."
        : identityBlocked
          ? "At least one source attestation is unreadable or does not match this artifact."
          : identityClean
            ? `${attestations.length} recorded attestation${attestations.length === 1 ? "" : "s"} match this artifact.`
            : "Source attestations exist, but verification is not complete.",
    },
    {
      key: "delivery",
      label: "Delivery integrity",
      summary: "Published URL and sealed-byte match",
      status: !deliveryApplicable
        ? "Not attached"
        : deliveryBlocked
          ? "Mismatch"
          : deliveryClean
            ? "Matched"
            : "Check needed",
      tone: !deliveryApplicable
        ? "not-configured"
        : deliveryBlocked
          ? "blocked"
          : deliveryClean
            ? "clean"
            : "waiting",
      applicable: deliveryApplicable,
      evidenceLabel: "Delivery evidence",
      evidence: !deliveryApplicable
        ? "No production delivery URL is attached. It is not counted as a required check."
        : deliveryBlocked
          ? "At least one attached delivery does not match the sealed artifact."
          : deliveryClean
            ? `${locations.length} attached deliver${locations.length === 1 ? "y matches" : "ies match"} the sealed bytes.`
            : "An attached delivery still needs a completed verification.",
    },
    {
      key: "governance",
      label: "Release governance",
      summary: "Approval decision and legal hold",
      status: !governanceApplicable
        ? "No decision"
        : governanceBlocked
          ? release.legalHold?.active
            ? "Legal hold"
            : "Rejected"
          : governanceClean
            ? "Approved"
            : "Waiting",
      tone: !governanceApplicable
        ? "not-configured"
        : governanceBlocked
          ? "blocked"
          : governanceClean
            ? "clean"
            : "waiting",
      applicable: governanceApplicable,
      evidenceLabel: "Governance evidence",
      evidence: !governanceApplicable
        ? "No approval or legal-hold decision is recorded. It is not counted as a required check."
        : release.legalHold?.active
          ? `A legal hold was placed by ${release.legalHold.actorLogin}.`
          : release.approval
            ? `${release.approval.decision === "approved" ? "Approved" : "Rejected"} by ${release.approval.actorLogin}${release.approval.reason ? `: ${release.approval.reason}` : "."}`
            : "A governance decision is still pending.",
    },
  ];

  const applicable = steps.filter((step) => step.applicable);
  const cleanChecks = applicable.filter((step) => step.tone === "clean").length;
  const blocked = steps.some((step) => step.tone === "blocked");
  const ready = artifactClean && !blocked && applicable.every((step) => step.tone === "clean");

  return {
    blocked,
    ready,
    title: blocked ? "Hold this release" : ready ? "Ready to release" : "Evidence still pending",
    detail: blocked
      ? "At least one recorded check blocks a clean release receipt."
      : ready
        ? "Every required check recorded for this revision supports release."
        : "The artifact is not blocked, but one or more required checks still need evidence.",
    status: blocked ? "blocked" : ready ? "ready" : "pending",
    applicableChecks: applicable.length,
    cleanChecks,
    steps,
  };
}

export function releaseFamily(coordinate: string): string {
  const hash = coordinate.indexOf("#");
  const withoutSuffix = hash >= 0 ? coordinate.slice(0, hash) : coordinate;
  const at = withoutSuffix.lastIndexOf("@");
  return at > 0 ? withoutSuffix.slice(0, at) : withoutSuffix;
}
