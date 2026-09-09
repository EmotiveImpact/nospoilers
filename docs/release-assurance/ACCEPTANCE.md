# Complete vision: implementation and acceptance map

## Current optional explanation contract increment

The connected explanation UI/API, explicit provider adapter contract, configuration-bound consent, workspace-wide call/reserved-spend limits, idempotent requests, cancellation and human-reviewed drafts are implemented. Migration ra_010 links private drafts to retained snapshots; it enables no provider. Exact data and activation boundaries: EXPLANATIONS.md. Production composition remains unavailable by default. A concrete paid-provider adapter, provider-specific evaluations/charge verification, finding-level root-cause assistance and deployment/review attestation remain unbuilt/unverified respectively; do not describe generic aggregate explanations as those capabilities. BUILD-LOG records local checks and remaining acceptance.

Owner update, 9 September: customer-facing synthetic dev review has been removed. Keep QA fixtures internal. Real GitHub setup/live verification is deferred to production by request; do not count that as verified or recreate a fake workspace for the owner. Original Gate B remains accepted; newer release-assurance scope is additive, while Gates C/D/E retain their separate requirements.

Current Gate C increment: parity choices expose verified eligibility and recovery labels rather than calling every website verified. History selection names/announcements and failed mutation focus recovery are covered by focused rendered checks; initial read failures do not steal focus. Existing skeletons cover agent/remediation reads. This closes those specific interaction gaps, not full WCAG or production acceptance. See BUILD-LOG for cumulative results.

Coordinated visibility correction (after92dd29f): history can perform its own authorization after assurance failure; pending scans remain gated. Parity/remediation/agent failures discard stale actions, evidence and displayed credentials. Full core UI regression 1,326 tests / 226 files passed. Most remaining hidden controls are deliberate stream/role/reference/source prerequisites, not missing API mounts. Provider explanations/attestation, remote MCP OAuth and agency remain unbuilt. Dev-review launcher is independently opt-in and must not alter production authorization.

History discovery/recovery increment (after 506a235): empty/unselected stream state now explains available tools and prerequisites, with a setup button that opens and focuses the form without mutation. Failed stream-list reads/mutations/exports hide old controls; workspace/record changes reset requests/state. Export validates explicit server-returned workspace/stream scope. Focused component/database/real API checks and actual synthetic setup-to-export flow pass; see latest BUILD-LOG for final full-suite result. Broader operational/provider and complete accessibility acceptance remain open.

Latest gate-state acceptance increment (after 37a89f6): expired, consumed and superseded decisions no longer offer an override; expiry updates while open. Failed writes clear stale controls and reset consent; switching record/stream invalidates the old binding immediately. Refresh uses the existing skeleton. Actual API tests prove wrong digest/deployment, viewer/foreign access and token revocation cannot consume an outstanding decision. Full 1,306 tests / 223 files passed; native PostgreSQL + UI 9 tests passed. Built-app synthetic superseded decision and keyboard/mobile disclosure verified. This closes these specific stale-state cases, not the full role/error/operational matrix.

## Latest outcome-summary increment (after 55c7982)

Opt-in monthly outcomes are implemented through real session-authorized routes and the existing release-detail panel. Defaults off; explicit administrator consent, revision conflict protection, immediate opt-out and current-authority private export. Counts distinguish verified records, distinct bytes, repeated checks, unavailable evidence and bounded partial windows. Current remediation/reference status is separate from monthly historical scan outcomes. No email, analytics provider, employee tracking, savings claim or new history archive. See `OUTCOMES.md`.

Verification: full 1,300 tests / 223 files passed; focused 11 tests / 3 files passed; disposable native PostgreSQL integration passed; typecheck, frontend/API builds, lint and diff check passed with existing warnings. Built-app synthetic browser opt-in, two-artifact summary, nested disclosure, refreshed JSON export and opt-out verified; no horizontal overflow at 390/1365px or console errors. Wider keyboard/role/error matrices, operational concurrency/load acceptance, optional model-provider contracts and customer validation remain open. Agency remains after core acceptance. Older “retention outcomes unbuilt” entries are superseded, not evidence that the whole platform is complete.

Latest continuation: 9 September 2026. Read `INTELLIGENCE-HANDOFF.md` for exact new contracts and verification boundaries. This table is a status ledger, not a feature-completeness or launch claim.

Latest agent update (after f1bab87): seven bounded stdio MCP tools, dedicated stream credentials, current authority checks, audit and administrator-reviewed draft notes are implemented in the actual release-detail flow. Final full regression passed 1,289 tests / 220 files. See `AGENT-TOOLS.md` and the latest build log for native/browser scope. No provider-backed model explanation, remote MCP OAuth service, autonomous PR action or paid provider is implemented/activated here. Retention outcomes remain unbuilt; broader operational/accessibility/client acceptance remains open. This supersedes older statements below that all MCP work is unbuilt.

Latest remediation update (after 39ce185): durable original-finding → human-reviewed change → signed rebuilt-artifact observation is implemented in the real API and both detail mounts. Full regression 1,279 tests / 217 files passed; native PostgreSQL lifecycle passed; built-app synthetic end-to-end flow verified on mobile/desktop. Review/build provenance remains human-declared, not provider-attested. Broader concurrency/accessibility/operational acceptance is still open. Agent/MCP and retention outcomes remain unbuilt; older unbuilt descriptions below are historical checkpoints.

Latest gate update (after 34747bc): connected-source CI grants are implemented through the real gate API, CLI and release-detail controls, with explicit exact-asset scope, expiry/revocation, current administrator authority and installation/repository lifecycle checks. Final runtime regression: 1,260 tests / 214 files passed; native PostgreSQL integration passed; built-app grant/revoke verified with synthetic data at desktop/mobile sizes. Confirmation-only copy has a separate component/build check. See BUILD-LOG for boundaries. Wider races, full accessibility and operational rollout remain open; durable remediation, agent/MCP and outcome retention remain unbuilt. Older checkpoint descriptions below are historical, not a claim these new capabilities are absent.

9 September update: canonical readiness is implemented at `085ac46`. The following automatic-capture increment has connected opt-in controls and completion jobs, with 1,234 full-suite tests passing (before a final test-only job-claim correction), two updated integration tests passing, and desktop/mobile built-app enable/disable checks. The hosted integration ran on disposable native PostgreSQL; the independent website case used PGlite. Remaining lifecycle/operational evidence is explicit below; older unbuilt statements describe earlier checkpoints. None of this accepts the whole platform or authorises rollout.

| Discussed capability | Current branch implementation | Remaining work or evidence |
| --- | --- | --- |
| Release as central object and canonical detail | Existing ledger/detail retained; historical intelligence mounted in both detail paths; canonical server-grounded headline cutover implemented | Complete integrated keyboard/role/error matrix remains open |
| Persistent release history | Existing signed records plus new compact FK-linked historical snapshots | Real adapter/retention/deletion integration and production PostgreSQL validation; no perpetual archive promise |
| Stable release-stream identity | Implemented explicit workspace/name/key/artefact-role streams; source/channel/format bound from authorised evidence | Operator must select the correct product; no automatic filename grouping; no automatic bulk migration |
| Release comparison and unexpected files | Existing comparison plus new bounded exact-path/finding history and approved-reference comparisons | Full actual historical dataset and browser acceptance; content-hashed paths can be legitimately novel |
| Human-approved baselines | Implemented adopt/revoke events, revision checks, reasons, audit and current/as-of reference distinction | Production concurrency, real auth and retention/tombstone validation |
| Customer-specific normal behaviour | Implemented median/MAD advisory analysis, minimum eligible samples, deduplication, exclusions/restoration and explicit comparison windows | Not an ML model; heuristics need customer calibration and load testing; no calibrated probability or security score |
| Automatic history capture | Explicit UI/API/CI capture preserved; opt-in exact-source completion hooks use durable jobs and revisioned grants; missing-seed stop controls and competing revisions verified locally | Operational rollout and broader lifecycle acceptance remain open. No live rule enabled |
| Deterministic readiness | Canonical HMAC-verified server assessment drives hosted/upload detail/list and additive token scan readiness; separate versioned opt-in gate is implemented | Broader cross-flow lifecycle/accessibility acceptance; never equate scan outcome with deployment permission |
| Policy engine and exceptions | Existing scanner policy preserved; separate opt-in versioned Release Gate with explicit override and rollback; independent-upload and explicitly granted connected-source CI implemented | Wider governance races and operational rollout remain open; no customer enforcement enabled automatically |
| Policy preview | Existing reversible stricter-findings preview retained | Not a full policy editor or automatic adoption flow |
| Before/after separation | Canonical pre-deploy assessment, opt-in pre-deploy gate and separate bounded production observation | Continue checking this separation in broader operational acceptance |
| Production verification | Existing saved delivery checks interpreted with binding/freshness | Runtime verification; no new delivery worker |
| Production multi-asset parity | Bounded approved-manifest mappings to a verified origin; declared deployment identity; durable worker observations and integrated UI; matched/missing/extra/mismatched/unobserved/unsupported states | Deployment identity is customer-declared, not provider-attested. Compressed/transformed outputs and cross-origin redirects are unsupported. Wider race/accessibility/load acceptance and provider/region expansion remain open; never claim whole-site parity |
| Continuous Coverage | Existing product retained | Existing operational launch gates and explicit stream linkage; no new CDN schedule |
| Release Passport | Private redacted unsigned summary tied to original receipt; new private history metadata export | Not independent certification, not a new public proof authority |
| Remediation to rescan | Durable signed original finding, human-reviewed change declaration, rebuilt receipt and scoped read-time observation; existing PR tooling retained | Provider-attested causal change/build linkage and broader workflow/accessibility/operational acceptance |
| Investigation agent | Existing deterministic assistance and machine-readable assurance reads retained | No new LLM investigation or root-cause attribution |
| Model-generated remediation PR | Existing bounded remediation workflow retained | Provider integration, cost limits, evaluations, authority separation and human approval |
| Agent evidence summaries | Seven scoped deterministic tools, stdio MCP adapter, explicit administrator grants, budgets/audit and human-reviewed draft notes | Provider-backed explanations and spending contracts, remote MCP OAuth if required, wider client/race/accessibility acceptance; no paid activation |
| No automatic merges or disclosure | Preserved | Verify all new composition paths in full integration |
| Artifact Leads / Disclosure Desk separation | Untouched and internal | No new commercial CRM lifecycle in this continuation |
| Commercial versus disclosure states | Separation documented in outreach and handoff | Commercial-state expansion remains separate implementation |
| Navigation and homepage | Approved baseline preserved; history appears within current release details | No wholesale redesign |
| Accessible behavioural UI | Existing companion plus actual history selection, explicit reasons, reversible exclusions, private export, keyboard/reduced-motion styles | New real React/browser/accessibility review remains; not an empirically proven retention improvement |
| Long-term retention | Useful compounding history and reference workflows implemented as product hypotheses | Measure real repeat-release use, investigation effort and retained subscribers |
| Agency portfolio | Not implemented here | Delegation, multi-client visibility, privacy and commercial controls |
| Enterprise SSO, SBOM, Sigstore | Remain on ice | Separate demand/approval and implementation |
| Tests | Full local suites, real Hono/session/token/HMAC tests, disposable PostgreSQL and synthetic browser checks executed in the increments above | Exact source/results and narrower coverage in BUILD-LOG; remaining full operational/accessibility matrix is not proven by test totals |

## 9 September integration checkpoint

Follow-on readiness cutover: hosted/upload list and detail surfaces now receive the shared server-verified assessment, with token scan readiness additive to its original outcome. Hosted and upload heroes use canonical semantics and refresh failure becomes UNKNOWN; delivery remains separate and attestation metadata does not become verified identity. Final full regression passed 205 files / 1,229 tests; the updated native PostgreSQL integration test passed, including the bounded batch. Integrated synthetic hosted/upload browser checks and hosted reference adoption/revocation passed; see BUILD-LOG for scope. The complete browser/accessibility matrix and remaining implementation sequence are not yet accepted.

The integration-repair tree based on `a4a3e10` passes the full supported-runtime regression: 205 files, 1,222 tests. Real Hono/store/session/token/HMAC integration and migration/concurrent-reference checks passed on PGlite and disposable native PostgreSQL. Scan-mode navigation and workspace-preserving claim navigation are repaired. See BUILD-LOG.md for exact scope and limitations; these results supersede historical unverified full-suite statements only for this increment.

Current boundary: canonical readiness, opt-in automatic capture, bounded production observation and versioned gate are implemented in the scopes recorded here and in BUILD-LOG. The full integrated browser matrix, connected-source CI capability and broader race/operational acceptance remain incomplete. Durable remediation, agent tools and retention outcomes remain unbuilt. Remote CI was externally blocked before execution by the GitHub billing/spending-limit annotation. PR #44 stays draft.

## Verification precedence

The original companion's 101 native and 55 browser checks describe its historical checkpoint. They are NOT test counts for this continuation. The database suite uses actual new SQL and service logic but injected access/evidence ports. No green full-branch CI or complete runtime integration is asserted here.

The new migration is `ra_002_release_intelligence`, applied after the existing schema chain. Do not run it against production merely to review the branch. Baseline and history operations now include writes; preserve CSRF, token capability and workspace authority checks.

## Continuation sequence

RA-01: run integrated verification and remove conflicting legacy readiness labels without silently changing policy semantics. In particular, attestation presence is not cryptographic identity verification.

RA-02: explicit stream identity and compact capture are implemented. Verify tenant/source boundaries and add opt-in worker completion capture only with stable, authorised stream identity and idempotent job semantics. Unknown identity stays unlinked.

RA-03: versioned baseline adoption/revocation, exclusions and advisory analysis are implemented. Verify real auth/retention/concurrency behaviour, then calibrate thresholds with customer evidence. Repeated mistakes and accepted exceptions cannot silently define a known-good baseline.

RA-04: bounded post-deploy observation is implemented with an adopted snapshot/receipt fingerprint, declared deployment ID and explicit file mapping. Distinct outcome states, cache metadata, same-origin redirects, identity-only transport, ownership expiry, cancellation and original-evidence linkage are covered locally. Finish broader concurrent revocation/long-delay/lease acceptance. Provider-attested deployment identity and cross-region cache proof are not implemented. This does not activate a deployment gate.

RA-05: versioned preflight contract is implemented: adopted advisory/warn/enforce, exact stream/record/digest/deployment binding, five-minute single-use decisions, age checks, audited non-clean override and append-only rollback. Connected tests and native PostgreSQL cover competing policy saves/consumption, stale evidence, revoked token and unchanged receipts; focused post-native cases cover decision expiry and reviewed-decision CLI consumption. Existing independent-upload token CI is supported; connected-source token capabilities, wider governance races and complete UI/operational acceptance remain open. Production evidence is never required before the deployment that creates it.

RA-06: durable remediation linkage from original finding to reviewed PR, build, new signed evidence and verified resolution. Acknowledgement or an accepted exception is not a fix.

RA-07: opt-in provider-backed assistance, tenant data boundaries, untrusted-content treatment, read/write capability separation, cost ceilings, evaluations and human review. A model never mints a passing receipt.

RA-08: opt-in outcome summaries and research instrumentation after privacy decisions. Use real release events and scoped denominators, not invented financial savings, forced logins or obstructed cancellation.

Keep PR #44 draft and preserve the branch deployment guard until applicable review and operational approvals are complete.
