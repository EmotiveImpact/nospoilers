# Architecture and decision contract

History UI is keyed to workspace and record identity. List responses must contain only the requested workspace's streams and links to listed streams; errors hide actionable history state. Private history exports carry explicit workspace/stream IDs, validated before Blob download. Existing server access checks remain authoritative; these client checks prevent stale or mismatched presentation, not a substitute for authorization. Empty-state capability discovery invokes only the existing explicit creation form.

Gate UI state is keyed by stream/record/refresh identity. It discards stale actionable data on failed mutations and during refresh; decision expiry has a bounded next-deadline timer. Recorded readiness remains historical, not present permission. Only the server can authorize consumption under current policy/evidence/credentials; disabled UI is not a security boundary.

## Private outcomes (9 September 2026)

`ra_009_release_outcomes` stores only stream preference/revision and uses the existing operational audit for changes. GET/POST `streams/:id/outcomes` require current human-session source access; configuration additionally requires administrator authority. Monthly reads are bounded and revalidate signed evidence, current remediation and reference availability. Exports re-fetch current authority rather than downloading a stale cached summary. No external event sink or persisted summary archive exists. The monthly GET has a separate 10/minute budget and a cooperative 20-second deadline; database queries are not preempted. See `OUTCOMES.md` for the event contract and partial-window semantics.

## Scoped agent tools (9 September 2026)

`ra_008_agent_access` adds hashed, fixed-scope short-lived grants, bounded call audit and immutable submitted drafts/human review records. Administrator session management is distinct from the `nsa_` bearer-only gateway. The gateway delegates only after checking the grant; ordinary token endpoints do not accept these credentials. Current source/installation generation and administrator access are rechecked, including after reads. Connected comparisons require the same asset selector. Pending proposals are the only agent mutation; human acceptance appends an existing remediation investigation event in the same transaction and checks the captured case revision. No policy/receipt/alert mutation is exposed.

`cli-mcp.ts` provides a local stdio lifecycle/tools/cancellation adapter, not a remote MCP/OAuth server. Fixed tool schemas and untrusted-data notices separate deterministic results from model explanations. No model provider or sampling is implemented or activated. See `AGENT-TOOLS.md` for customer setup, exact data boundaries, budgets, cancellation limits, retention and primary protocol references. Provider-backed assistance and wider client/operational acceptance remain separate work.

## Durable remediation (9 September 2026)

`ra_007_remediation` binds a case to an immutable original snapshot and signed finding fingerprint. Append-only events record human investigation, reviewed change declarations, scoped signed rebuild observations and reopening. Workspace locks and expected revisions serialize mutations. Reads inspect only one selected case and re-derive its current observation from authorized original/new receipts; a historical successful check cannot remain current after expiry or evidence deletion. Reopening or a new reviewed change invalidates the previous current observation. Original-snapshot deletion cascades cases/events; candidate references are checked for availability rather than perpetually retaining deleted evidence.

The signed adapter optionally exposes a full signed source revision hash; contradictions with the declared reviewed commit yield unknown. This is not provider attestation. Equal scanner/policy and exact connected-asset identity, newer bytes/time, freshness, no suppression and no hold are required. Same-rule findings on a different path cannot be used to fake a fix. Website observations remain in the production lane. Neither a case state nor a model can mint a receipt, approve a deployment or close an alert through this API. Human remediation notes are not exposed to existing scan tokens.

## Connected-source gate capability (9 September 2026)

Migration `ra_006_gate_ci_access` adds opt-in grants keyed by stream/token and a capability key on gate decisions. The gate-route-only adapter delegates signed-evidence reads to the granting administrator's current authority, but audits the token actor and denies all management operations. Asset selector, channel/format, source generation, installation generation, expiry and token/workspace boundaries are checked. The installation counter advances on suspension/disconnection changes, including reconnection, so an old grant cannot silently resume. Grant renewal changes the capability key and invalidates decisions made under the old grant. Current policy is readable; general decision/policy history is not returned to this capability. Other API routes retain their ordinary token permissions.

Administrative grants require explicit confirmation, reason, current revision and a bounded expiry; disabling is separate from entitlement-gated enabling. No token secret is returned by these controls. This extends the independent-upload gate below rather than changing scanner outcomes or granting general GitHub access.

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
