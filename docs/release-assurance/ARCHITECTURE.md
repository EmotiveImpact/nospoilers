# Architecture and decision contract

## Versioned gate addition (9 September 2026)

`ra_005_release_gate` stores append-only policy revisions, evidence-bound decisions, overrides and consumptions. Gate evaluation reuses `assessRelease` through the verified intelligence adapter, adding an explicitly adopted age bound and excluding website observations from pre-deploy build permission. Policy mutation and consumption serialize on the workspace row; consumption rechecks current permissions, policy revision, original evidence fingerprint, current governance, digest, deployment identity and expiry. Each decision can be consumed once. Rollback appends a new policy revision; it never rewrites history or revalidates an older decision.

Advisory/warn return `not_enforced`, never `allowed`; warn emits a CLI warning for non-ready evidence. Enforce returns allowed, explicit override or denied. An override cannot apply to unknown/stale evidence or a recorded hold, and never changes the original readiness or receipt. There is no implicit deployment interception: a customer must explicitly integrate the CLI/API step. Existing workspace-token boundaries remain; connected source CI grants are not broadened. See handoff for supported independent-upload CI usage and remaining acceptance.

## Current production-observation addition (9 September 2026)

The companion-only descriptions below are historical. The branch now has `ra_002` history, `ra_003` opt-in capture and `ra_004` production-observation migrations. Production runs reuse an explicitly adopted signed reference and store binding metadata, hashes and bounded outcomes, not fetched source bodies. Original evidence deletion controls dependent run retention.

An authorised request reserves the existing workspace scan allowance and creates a heavy job with immutable payer ownership. The worker holds no DB lock across HTTPS calls, rechecks authority between requests and before saving, and discards results if the binding changes. Scope is one owned origin, explicit mappings, identity representations, bounded HTML discovery and cache metadata. Deployment identity is declared, not provider-attested. No observation supplies a before-deploy enforcement pass. See the latest handoff and acceptance ledger for limits and remaining work.

## Reuse, do not replace

The existing scanner, receipt, ledger, policy, exception, notification, watch, deployment-verification and reviewable remediation workflows remain the source systems. This increment reads their evidence. It does not add a second scanner, a source-code store or an authority that can override them.

Request -> existing authorised record read -> scope metadata -> existing receipt read -> original server HMAC verification -> semantic identity validation -> comparison/assessment -> private view/export.

The public API wrapper is composed before the original app's SPA catch-all in `runtime.ts`. Calls to `read` invoke the core application's handler in process, never network self-fetch. Only the caller's Cookie/Authorization and Accept are forwarded. The privileged scope callback runs only after the existing release endpoint authorised the request. Both records are re-authorised before the combined view is returned. This reduces revocation races; it is not a claim of transactional linearizability across multiple database reads.

## Invariants

A valid receipt signature proves authenticity of that signed record, not security of the artefact. Ready requires valid and semantically consistent evidence bound to the same digest, coordinate and channel. Missing/invalid/inconclusive evidence stays unknown. A saved failure or recorded rejection/hold cannot be overridden by an approval or an assistant.

Optional checks are not automatically mandatory. An absent approval policy is not invented. Attestation presence is metadata, not Sigstore/SLSA verification. Accepted exceptions remain visible and are not portrayed as a clean zero-finding release. Strict review is a read-only simulation, not a saved rule change.

The before-deployment interpretation and after-deployment observations are separate. Otherwise a release gate could wait forever for the deployment it prevents. No new enforcement is activated by this companion. A new enforcement contract needs explicit adoption, policy/version binding, expiry, least privilege, timeout behaviour, recovery and audited overrides before it can replace existing CI behaviour.

## Bounded comparison

Use a stable, conservative source key inside one authorised installation. Preserve npm package scope, registry qualifiers and GitHub release-asset identifiers; preserve web origin/path. Never compare arbitrary same-name uploads or different beta/stable channels. Require the same recorded media type and an earlier passing reference without accepted exceptions, rejection, hold or digest mismatch.

Compare exact manifest path, bytes and digest. Counts cover both compared manifests; displayed file paths cap at 50 per category. Include suppressed fingerprints when calculating disappearance, so a new exception is not called a fix. Mark changed scanner and policy versions as interpretation context. Unknown or zero sizes do not create invented percentage changes.

The automatic read considers one history page and at most three candidate receipts. “No earlier compatible record found” is not a complete history audit. Unreadable history is explicitly different. A passing comparison reference is not an automatically adopted or permanently trusted baseline.

`sizeHistory` provides a tested median/MAD helper with five-sample minimum and 30-sample cap. It is not yet wired to persisted customer baseline adoption or automatic anomaly alerts.

## Delivery

Interpret only saved locations attached to this exact release. A positive match needs the expected digest, explicit matched outcome, valid timestamp no earlier than the scan and a fresh observation. Default interpretive freshness is 24 hours, not a new monitoring promise. Unreachable/missing/error is unknown, not proof of mismatch. Stale evidence does not stay permanently green.

This is a single-artefact digest observation, not comprehensive browser-asset parity. A complete parity feature still needs approved asset manifests, representation/encoding rules, CDN and multi-origin boundaries, deployment identity, cache/race handling and bounded discovery coverage. A website crawl cannot prove that no other public file exists.

## Data and cost

No new source retention, tables, migrations, dependencies or external model calls. Each saved JSON read caps at 8 MiB; manifest/fingerprint validators cap at 25,000 entries. The whole read has a 15-second abort deadline; abandoning a wait does not guarantee a underlying database query was cancelled. No new scan work is queued.

Responses are no-store, vary by Cookie/Authorization and omit detailed data on access errors. The native renderer uses text nodes, not HTML interpolation, for untrusted filenames. React aborts reads when the selected record changes; different record IDs reset the companion. Full integration and hostile-load testing remain required.

## Passport and assistance

The private passport omits file paths, findings, reviewer identities and public capability links. It retains release identity and digests, so review is still needed before sharing. It is explicitly an unsigned summary with a reference to the original signed receipt. It is not an independent attestation, a certification, a public-key trust mark or a lifetime guarantee.

Assistance is deterministic rule-based guidance. It cannot infer a responsible PR from a timestamp, call a model, use discovered credentials, execute changes, alter policy, approve exceptions, merge or send disclosures. The bearer read route allows an authorised external tool to retrieve the same bounded interpretation. MCP, provider orchestration, tenant consent, evaluation, cost budgets and reviewable model-generated changes remain future implementation.
