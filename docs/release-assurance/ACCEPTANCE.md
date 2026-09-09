# Complete vision: implementation and acceptance map

Latest continuation: 8 September 2026. Read `INTELLIGENCE-HANDOFF.md` for exact new contracts and verification boundaries. This table is a status ledger, not a feature-completeness or launch claim.

| Discussed capability | Current branch implementation | Remaining work or evidence |
| --- | --- | --- |
| Release as central object and canonical detail | Existing ledger/detail retained; assurance and historical intelligence mounted in both hosted and uploaded details | Integrated visual/route acceptance and one-authority headline cutover |
| Persistent release history | Existing signed records plus new compact FK-linked historical snapshots | Real adapter/retention/deletion integration and production PostgreSQL validation; no perpetual archive promise |
| Stable release-stream identity | Implemented explicit workspace/name/key/artefact-role streams; source/channel/format bound from authorised evidence | Operator must select the correct product; no automatic filename grouping; no automatic bulk migration |
| Release comparison and unexpected files | Existing comparison plus new bounded exact-path/finding history and approved-reference comparisons | Full actual historical dataset and browser acceptance; content-hashed paths can be legitimately novel |
| Human-approved baselines | Implemented adopt/revoke events, revision checks, reasons, audit and current/as-of reference distinction | Production concurrency, real auth and retention/tombstone validation |
| Customer-specific normal behaviour | Implemented median/MAD advisory analysis, minimum eligible samples, deduplication, exclusions/restoration and explicit comparison windows | Not an ML model; heuristics need customer calibration and load testing; no calibrated probability or security score |
| Automatic history capture | Explicit UI/API capture and CI scan-and-record command implemented | An opt-in capture hook for every original GitHub/npm/website worker completion is NOT implemented |
| Deterministic readiness | Original receipt-bound assurance interpretation retained | Advisory only; whole-app verdict cutover remains open |
| Policy engine and exceptions | Existing policy/exception engine preserved; historical reference changes never rewrite them | No newly adopted enforcement policy in this continuation |
| Policy preview | Existing reversible stricter-findings preview retained | Not a full policy editor or automatic adoption flow |
| Before/after separation | Implemented in the original companion | Reconcile legacy headline and future enforcement contract |
| Production verification | Existing saved delivery checks interpreted with binding/freshness | Runtime verification; no new delivery worker |
| Production multi-asset parity | Not implemented here | Approved manifest/deployment identity, transformations, origin scope and race handling |
| Continuous Coverage | Existing product retained | Existing operational launch gates and explicit stream linkage; no new CDN schedule |
| Release Passport | Private redacted unsigned summary tied to original receipt; new private history metadata export | Not independent certification, not a new public proof authority |
| Remediation to rescan | Existing controls and rule-based guidance retained | Durable original finding to reviewed PR/build/new receipt resolution linkage |
| Investigation agent | Existing deterministic assistance and machine-readable assurance reads retained | No new LLM investigation or root-cause attribution |
| Model-generated remediation PR | Existing bounded remediation workflow retained | Provider integration, cost limits, evaluations, authority separation and human approval |
| Agent evidence summaries | Structured deterministic summaries retained | No new provider-backed generation or MCP server |
| No automatic merges or disclosure | Preserved | Verify all new composition paths in full integration |
| Artifact Leads / Disclosure Desk separation | Untouched and internal | No new commercial CRM lifecycle in this continuation |
| Commercial versus disclosure states | Separation documented in outreach and handoff | Commercial-state expansion remains separate implementation |
| Navigation and homepage | Approved baseline preserved; history appears within current release details | No wholesale redesign |
| Accessible behavioural UI | Existing companion plus actual history selection, explicit reasons, reversible exclusions, private export, keyboard/reduced-motion styles | New real React/browser/accessibility review remains; not an empirically proven retention improvement |
| Long-term retention | Useful compounding history and reference workflows implemented as product hypotheses | Measure real repeat-release use, investigation effort and retained subscribers |
| Agency portfolio | Not implemented here | Delegation, multi-client visibility, privacy and commercial controls |
| Enterprise SSO, SBOM, Sigstore | Remain on ice | Separate demand/approval and implementation |
| Tests | New native/Vitest domain, request and CI cases; actual PGlite schema/service suite written | Final committed source needs full locked test/type/build/lint, real auth/HMAC/Hono, PostgreSQL and browser checks |

## 9 September integration checkpoint

The integration-repair tree based on `a4a3e10` passes the full supported-runtime regression: 205 files, 1,222 tests. Real Hono/store/session/token/HMAC integration and migration/concurrent-reference checks passed on PGlite and disposable native PostgreSQL. Scan-mode navigation and workspace-preserving claim navigation are repaired. See BUILD-LOG.md for exact scope and limitations; these results supersede historical unverified full-suite statements only for this increment.

Not yet accepted: canonical readiness cutover, the full integrated browser matrix, automatic capture, production parity, versioned enforcement, durable remediation, agent tools and retention outcomes. Remote CI remains externally blocked before execution by the GitHub billing/spending-limit annotation. PR #44 stays draft.

## Verification precedence

The original companion's 101 native and 55 browser checks describe its historical checkpoint. They are NOT test counts for this continuation. The database suite uses actual new SQL and service logic but injected access/evidence ports. No green full-branch CI or complete runtime integration is asserted here.

The new migration is `ra_002_release_intelligence`, applied after the existing schema chain. Do not run it against production merely to review the branch. Baseline and history operations now include writes; preserve CSRF, token capability and workspace authority checks.

## Continuation sequence

RA-01: run integrated verification and remove conflicting legacy readiness labels without silently changing policy semantics. In particular, attestation presence is not cryptographic identity verification.

RA-02: explicit stream identity and compact capture are implemented. Verify tenant/source boundaries and add opt-in worker completion capture only with stable, authorised stream identity and idempotent job semantics. Unknown identity stays unlinked.

RA-03: versioned baseline adoption/revocation, exclusions and advisory analysis are implemented. Verify real auth/retention/concurrency behaviour, then calibrate thresholds with customer evidence. Repeated mistakes and accepted exceptions cannot silently define a known-good baseline.

RA-04: implement bounded post-deploy asset parity with approved manifest hash and deployment ID. Missing, extra, mismatched, unobserved and unsupported states remain distinct. Test compressed/transformed assets, cache propagation, redirects, ownership expiry and delayed observations.

RA-05: version and explicitly adopt a new preflight enforcement contract. Test timeout, stale receipt, digest binding, concurrent policy changes, audited override and rollback. Post-deployment evidence must not be required before permission to deploy.

RA-06: durable remediation linkage from original finding to reviewed PR, build, new signed evidence and verified resolution. Acknowledgement or an accepted exception is not a fix.

RA-07: opt-in provider-backed assistance, tenant data boundaries, untrusted-content treatment, read/write capability separation, cost ceilings, evaluations and human review. A model never mints a passing receipt.

RA-08: opt-in outcome summaries and research instrumentation after privacy decisions. Use real release events and scoped denominators, not invented financial savings, forced logins or obstructed cancellation.

Keep PR #44 draft and preserve the branch deployment guard until applicable review and operational approvals are complete.
