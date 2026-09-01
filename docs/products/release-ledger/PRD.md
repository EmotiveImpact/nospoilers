# Release Ledger — NoSpoilers Module PRD

Release Ledger is a later NoSpoilers module. It uses the existing repository, customer account,
artifact identity, policy, scan result, queue and billing system.

## Product

Create a verifiable ledger of approved software artifacts, their hashes, provenance, signatures,
SBOMs and delivery locations; continuously confirm that registries/CDNs still serve the approved
bytes.

## Buyer

- Release/platform engineering
- Software supply-chain security
- Compliance and procurement
- Vendors distributing downloadable software

Its promise is **integrity and provenance**, complementing NoSpoilers confidentiality and exposure
protection without asking customers to install another product.

## Problem

Teams may scan and sign one artifact but publish, replace or serve another. Release assets can move
between CI, registries, object storage and CDNs without a durable record tying approved bytes to
what users receive.

## Positioning

“Prove that the file customers download is the file your pipeline approved.”

## Phase 1 — immutable release record

- Project and release creation API/CLI.
- Artifact SHA-256/SHA-512, size, media type and canonical delivery URLs.
- Build/source revision and CI run link.
- Scanner/policy result references.
- Append-only release events.
- Signed receipt downloadable as JSON.
- Verification command that re-hashes a local file.
- Dashboard with release and verification status.

Acceptance:

- Re-uploading different bytes under one artifact identity creates an explicit mismatch event.
- Historical records cannot be silently edited.
- Receipt signature verifies offline.
- No artifact bytes are required for long-term retention.

## Phase 2 — provenance, signatures and SBOM

- Sigstore/cosign signature and certificate verification.
- SLSA/in-toto provenance ingestion.
- CycloneDX/SPDX SBOM attachment and validation.
- npm provenance and GitHub attestation adapters.
- Signing-policy rules and expiration.
- Keyless and customer-managed key support.
- Audit export and webhook events.

Acceptance:

- Invalid, missing, expired and wrong-subject signatures are distinct.
- Provenance links artifact digest to expected source and workflow identity.
- SBOM is associated by digest, not filename.

## Phase 3 — delivery verification

- Scheduled registry/CDN URL verification.
- Redirect-chain, cache and region checks.
- npm, GitHub Releases, S3/R2 and generic HTTPS adapters.
- Detect replacement, disappearance, unexpected redirect or content-type change.
- Email, Slack, Jira, SIEM and PagerDuty routing.
- Public verification page controlled by customer.

Acceptance:

- Verification downloads are bounded and use streaming hashes.
- Signed/authorized URLs never enter public records.
- A changed object produces one deduplicated incident with old/new digest and timestamps.

## Phase 4 — governance

- Approval workflows and separation of duties.
- Multiple environments/channels: canary, beta, stable.
- Retention, legal hold and export.
- Team roles, SSO/SAML/SCIM after demand.
- API tokens, audit logs and customer-managed signing policies.
- Regional verification workers.

## Data model

- organizations/projects
- releases/channels
- artifacts
- artifact_locations
- digests
- signatures/certificates
- provenance_statements
- sboms
- policies
- approvals
- verification_runs
- incidents
- append_only_events
- notification_destinations
- audit_events

## Architecture

```text
CI/CLI/API → release record → Postgres append-only metadata
                         → receipt signer/KMS
Verification scheduler → streaming download/hash workers → incidents
Signature/provenance/SBOM adapters → policy engine
```

Do not store large artifacts by default. Store digests and signed metadata. Optional evidence
retention requires explicit customer policy and separate object storage.

Extend existing NoSpoilers entities and migrations. Do not create duplicate users, installations,
billing accounts, artifacts, policies, queues, notification destinations or authentication.

## Security requirements

- Use canonical digest representation and domain separation in signatures.
- Signing keys in managed KMS/HSM, never application database.
- Append-only events and audited corrections.
- SSRF defenses with private/reserved-address blocking, DNS/IP revalidation and redirect validation.
- Streaming size/time limits.
- Verify signed URL handling and log redaction.
- Tenant isolation and least-privileged API tokens.
- Independent receipt verification library/CLI.

## Packaging

- Artifact hashes, release manifests and signed scan receipts strengthen the existing Solo plan.
- Team receives provenance/SBOM integrations, scheduled delivery verification, routing and
  governance as those capabilities become operational.
- Do not create a separate Release Ledger subscription or change locked NoSpoilers pricing without
  an explicit product decision based on measured cost and demand.

## Metrics

- Verified releases and artifacts.
- Percentage with valid provenance/signature/SBOM.
- Verification latency and success rate.
- Delivery mismatches detected.
- Receipt verification usage.
- Gross margin per verification volume.
- Retention and expansion by project count.

## Non-goals

- Artifact hosting/CDN.
- General vulnerability scanner.
- Certificate authority.
- Source-code build service.
- Blockchain requirement.
- Claiming reproducible builds without evidence.

## First build acceptance

A CI client registers a real artifact digest and source revision, receives a signed receipt, verifies
it offline, then detects that a controlled URL serves different bytes. No artifact is retained.

## First agent prompt

```text
Continue inside EmotiveImpact/nospoilers after the Ultimate PRD reaches its Release Ledger phase.
Read docs/PRODUCT.md, the Ultimate PRD, feature inventory, and this module PRD. Extend existing
artifact manifests and scan runs with append-only release revisions, streaming SHA-256/SHA-512,
signed JSON receipts, offline receipt verification, and a Releases view. Reuse NoSpoilers tenancy,
billing, policy, queue, notification and audit boundaries. Use a development signer only behind an
adapter and document KMS as production-required. Do not create a second app/database/login, add
blockchain, store artifacts, or start SBOM/Sigstore/CDN scheduling yet. Test digest mismatch,
immutability, signatures and cross-tenant authorization. Commit and push; no PR unless asked.
```
