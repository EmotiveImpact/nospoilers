# Release intelligence continuation

Date: 8 September 2026. Branch: `codex/release-assurance-spine-v1`. Review container: draft PR #44.

## 9 September automatic capture increment

Migration `ra_003_automatic_capture` adds disabled-by-default stream capture rules and FK-linked attempts. `automatic-capture.ts`, `automatic-capture-identity.ts` and `automatic-capture-worker.ts` connect signed hosted publication and independent website completion to the existing capture service. Stable source, channel, format, artifact selector and source connection generation must match the explicitly selected stream. Manual uploads keep explicit UI/API/CI capture. No rule, reference or policy is silently adopted.

GET/POST `/api/release-intelligence/streams/:id/automatic-capture` expose settings and the ten most recent attempts. Enabling requires an active authorised administrator, expected revision, exact record confirmation and reason; disabling requires administrator authority but not active billing. The internal worker grant rechecks the enabling user's current authority and its own running lease, then reuses original receipt verification and snapshot transactions. Retry failures are sanitized and separate from the saved scan. Pausing/reconnecting a source invalidates old queued grants. The React control is mounted in both existing intelligence-panel contexts; a successful history refresh now preserves its disclosures while stale actions are disabled.

Verification: 207 files / 1,234 tests passed before the final test-harness-only change to use real `claimJob`; typecheck, frontend/API builds and lint (warnings, no errors) passed. The updated automatic-capture integration file passed two tests with the hosted test on disposable native PostgreSQL and the independent website test on PGlite. Built app at isolated port 4363 verified stream creation, enable/disable, preserved disclosure, 390px no overflow and zero console errors. Screenshots are local synthetic artifacts, not customer results. See BUILD-LOG for exact sequence and limitations.

Next: finish lifecycle acceptance (parallel configuration/deletion, missing-evidence recovery, broader keyboard/role browser cases) and continue bounded production parity. No production migration or deployment was run. This increment does not complete enforcement, remediation linkage, agent tools or retention outcomes.

## Scope and precedence

This continuation implements the next agreed milestone: explicit release streams, persistent compact snapshots, versioned human-adopted references, historical anomaly analysis, customer controls and a CI scan-and-record command.

It supersedes the earlier HANDOFF/ACCEPTANCE statements that streams and persisted baselines were wholly unbuilt, that the branch introduces no migration, and that all new routes are read-only. Those statements describe the original companion at commit `25b1abbf5de12fe45768dc82890a267913b7a667`, not this continuation.

The whole previously discussed Release Assurance platform is NOT declared complete. In particular, this work does not implement a new authoritative CI enforcement contract, full approved-build-to-production multi-asset parity, autonomous LLM/MCP investigation, durable remediation PR-to-receipt resolution, agency portfolios or automatic monthly emails. Historical intelligence is advisory and cannot change a signed receipt or secretly enable deployment blocking.

## Implemented source map

- `src/release-intelligence/model.ts`: explicit record references, stable stream dimensions, compact metrics and bounded semantic validation.
- `src/release-intelligence/analyse.ts`: earlier-release comparisons, sample eligibility, deduplication, median/MAD review thresholds, factual change signals and approved-reference comparisons.
- `src/server/release-intelligence-schema.ts`: migration `ra_002_release_intelligence`, scoped streams, immutable compact snapshots, baseline/exclusion revisions and audit events.
- `src/server/release-intelligence-service.ts`: transactional creation/capture/read/adoption/revocation/exclusion/restoration/export, original-evidence revalidation and bounded history retrieval.
- `src/server/release-intelligence-adapter.ts`: existing session/workspace-token authentication, membership/revocation/billing/source checks, original HMAC receipt validation and record-to-workspace resolution.
- `src/server/release-intelligence-app.ts`: Fetch request router with CSRF, rate, metadata-size and error-disclosure controls.
- `src/server/runtime.ts`: composes the new routes alongside the existing application and assurance companion; runs the additional migration after the original migration chain.
- `src/components/watch/ReleaseIntelligencePanel.tsx` and `release-intelligence.css`: actual customer controls, progressive detail, history selection, reference reasons, export and CI instructions.
- `src/components/watch/ReleaseAssurancePanel.tsx`: mounts history beneath the existing assurance interpretation in both hosted and uploaded release detail paths.
- `scripts/scan-release-stream.mjs`: uses the existing hosted scanner and explicitly records its completed result in a selected stream.

There is no new package dependency, external provider, new crawler, model service or background analytics scheduler.

## What a customer can do

1. Open an existing completed release and create a stream with a stable key, human name and artefact role. Workspace/source/channel/format are taken from the authorised record, not guessed from its filename.
2. Add other compatible completed releases explicitly, or use the provided CI command to scan and record subsequent builds in that stream.
3. Inspect new exact paths, returned or infrequent paths, new extensions, first-observed maps, executable-like extensions, new or returning finding fingerprints, size/file-count drift and changes against an approved reference.
4. An authorised administrator can adopt an eligible record as a reference with a reason and expected revision; replace/revoke it later without rewriting previous events.
5. Exclude or restore a record from current analytical context with an audited reason. This does not suppress scanner findings or change the original evidence.
6. Export bounded private history metadata without publishing a proof page or including file paths, actor names or source contents.

## Explicit capture, not magical automatic learning

Recording history is an explicit operation. The UI records an existing completed record; the CI helper performs scan then capture. It does not silently backfill the entire account, infer arbitrary products, or register every existing GitHub/npm/website worker completion automatically.

A future worker completion hook must carry an explicitly selected, authorised stream identity, preserve job lease/idempotency boundaries and handle a history-write failure without changing the original scan result. Do not claim that hook is already present.

Arbitrary uploads are grouped by operator-declared stream identity. Compatible format alone is not proof that two uploads represent the same product. The operator is responsible for choosing the correct product/artefact role; immutable dimensions and clear labels prevent silent reassignment.

## Data and retention

The new snapshot stores original record identity, digest, receipt fingerprint, metrics and analysis context. Original signed receipts and manifests remain in their existing store, authorisation and retention boundary. No second source/manifest archive is created.

Snapshot foreign keys follow deletion of the original uploaded scan/release. Database triggers reject direct mutation of snapshot and event rows while allowing parent-driven cascades. These trigger/cascade behaviours require the supplied SQL tests and production-like PostgreSQL validation before rollout.

Baseline events deliberately retain a reference identifier without pinning expired snapshot evidence forever. Missing, excluded, changed or newly ineligible original evidence makes the reference unavailable. There is no fallback to a formerly revoked reference and no assertion that an old signature means continued production safety.

The stream and its baseline/audit events remain until their owning workspace is deleted. They are metadata, not an indefinite source archive. The broader organisation deletion/export workflow must be checked against these new tables before launch.

## Analysis contract

- Read at most 60 earlier snapshot candidates; use at most 30 distinct prior artefact digests.
- Repeated scans of identical bytes do not inflate the statistical sample count.
- Excluded entries are not statistical training data. Historical comparisons are recalculated using current exclusions, explicitly without rewriting the original scan decision.
- Workspace, source, channel and format must agree. Statistical peers also require identical engine and policy fingerprints.
- Statistics use only passing records without findings, accepted exceptions or holds/rejection. Exact observed changes can still be shown for compatible conclusive history.
- At least five eligible distinct samples are required for statistical review; five is an initial product threshold, not scientific confidence in safety.
- Median/MAD review threshold: maximum of 30% of the median, 5.2 times median absolute deviation, and an absolute floor (1 MiB for size, 20 files for count). This is an inspectable heuristic, not a calibrated probability or security score.
- Limit accumulated historical evidence to 16 MiB and 100,000 manifest entries. A shortened window is explicitly labelled. Individual evidence and response/load behaviour still need production load testing.
- Signal lists and examples are bounded. A source map, unfamiliar extension or executable-like suffix is not automatically an unintended exposure or malware verdict.
- File comparison is exact-path comparison. Content-hashed filenames can cause legitimate novelty; do not silently normalise them into supposedly identical files.
- The reference effective at the original scan timestamp is separate from the current adopted reference. Adoption today cannot retroactively alter yesterday's release judgement.
- Analysis is computed on read from retained signed evidence. Captured compact metadata records its engine/policy/version, but this increment does NOT persist a background-generated anomaly model or calibrated ML scores.

## API contract

All routes are under `/api/release-intelligence/`.

| Method/path | Purpose |
| --- | --- |
| GET `record-context/upload/:uuid` or `record-context/release/:id` | Resolve workspace from an authorised saved record. |
| GET `streams?workspaceId=...&recordKind=...&recordId=...` | List visible streams and matching record links. |
| POST `streams` | Create an explicitly named stream from a completed record and capture it. |
| GET `streams/:id?snapshotId=...&before=...` | Scoped history, selected evidence, analysis, baseline events and pagination. |
| POST `streams/:id/records` | Idempotently capture `{record:{kind,id}}`. |
| POST `streams/:id/baseline` | Explicit adopt/revoke, reason and expectedRevision. |
| POST `streams/:id/exclusions` | Explicit exclude/restore, reason and expectedRevision. |
| GET `streams/:id/export` | Private unsigned bounded metadata export. |

Writes require active coverage and appropriate workspace authority. Expired subscriptions retain permitted historical reads; this is not a retention lock-in mechanism. Viewers cannot write. Independent workspace scan tokens can capture compatible workspace-upload evidence but cannot create/adopt/manage references or access connected installation release streams. Legacy installation tokens are intentionally unsupported by this new CI workflow.

Cookie-bearing writes require the exact configured application Origin. Bearer requests use their own authentication. Cross-site metadata is rejected. JSON metadata bodies are limited to 16 KiB and five seconds. Authenticated rate reservations are 120 reads and 30 writes per actor/minute; responses prohibit caching and indexing. Failures return bounded public errors, not arbitrary SQL/provider details.

## CI usage

Use an existing independently scoped workspace token with a stream created from an upload in that workspace. Keep credentials in CI secrets, never in a committed file.

```sh
export NOSPOILERS_BASE_URL='https://YOUR-APP-ORIGIN'
export NOSPOILERS_TOKEN='YOUR-WORKSPACE-TOKEN'
node scripts/scan-release-stream.mjs STREAM_UUID path/to/build.tgz
```

The command submits to the existing asynchronous `/api/v1/scan`, checks the exact acknowledgement/result ID, rejects redirected polling and records the completed signed evidence in the selected stream. The server verifies original receipts before accepting capture.

Exit 0: existing scan policy passed and capture was confirmed.
Exit 1: existing scan policy failed; conclusive history was still recorded.
Exit 2: workflow, timeout, inconclusive evidence or capture failure. No passing verdict is inferred.

Historical anomaly signals do not change these existing policy decisions. The command never adopts a reference, changes policy or merges a PR. The 80 MiB file bound does not establish that the selected hosting ingress accepts 80 MiB; verify the provider limit separately.

## Test inventory and honest verification boundary

The repository contains a dependency-free native test runner and Vitest wrappers using the same domain, HTTP-boundary and CI cases:

```sh
node --experimental-strip-types --test scripts/test-release-intelligence.mjs
npm test -- tests/release-intelligence.test.ts tests/release-intelligence-api.test.ts tests/release-intelligence-cli.test.ts
npm test -- tests/release-intelligence-db.test.ts
```

The database suite executes the actual new migration and service against PGlite with minimal parent tables. Its authentication/evidence ports are injected. It tests real storage, immutability, retention cascades and version checks, but does not prove the real session/token/HMAC adapter or multi-process PostgreSQL concurrency.

No final whole-branch passing test count, full TypeScript 6 build, full regression, real-React browser acceptance or production deployment is certified by this document. Earlier local subset runs and the original companion's 101/55 checks must not be relabelled as verification of this continuation. Run the final committed source, not an earlier local draft, and record the terminal result and commit under test.

Before merging:

1. Install the locked dependencies, run the new native/Vitest/PGlite suites, then full `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` and `npm run build:api`.
2. Exercise the real runtime composition and adapter with actual store/session/workspace-token/HMAC fixtures. Include anonymous/foreign/revoked access, viewer writes, expired billing, connected-source access and unchanged original routes.
3. Test concurrent adoption/exclusion/record capture, membership revocation and retention/deletion against production-like PostgreSQL. Make authorisation races explicit rather than treating sequential test ports as proof.
4. Verify both integrated release-detail mounts in a real browser: create, existing link, capture, baseline reason/conflict, revoked reference, history pagination, export, workspace navigation, unmount, loading/error, mobile and keyboard. No sample customer data may appear in the production UI.
5. Check query/memory/runtime budgets and existing staging, parser isolation and ingress gates. Do not deploy or run a production migration as part of this branch review.

## Next engineering work

Readiness follow-on after f2e7ba1: do not restore the legacy client-side passing-status inference. `release-assessment.ts` projects `assessRelease` through authorised original endpoints; list/detail heroes consume it, and the supporting panel updates their assessment after refresh. Preserve scan outcome versus readiness versus production observation. The final full suite passed 1,229 tests and native PostgreSQL integration passed, including the new bounded batch. Next finish the lifecycle/accessibility matrix, including preserving disclosure/focus on history refresh, then implement opt-in automatic capture using the existing stream service. Remaining sequence is unchanged.

9 September checkpoint: integration repairs now pass 1,222 full-suite tests across 205 files on Node 24.19.0. The new real-composition integration test also passed against disposable native PostgreSQL, including concurrent adoption. See BUILD-LOG.md for the changed surfaces and partial browser evidence. Preserve these repairs; do not restart the completed integration investigation. Finish the outstanding integrated browser cases and make legacy and assurance readiness share one server-grounded interpretation next. Remote Actions still cannot start because of the account billing/spending-limit condition; this does not prevent local implementation.

First obtain integrated evidence for this milestone and resolve any failures. Then reconcile the old readiness headline and the advisory companion into one tested policy-aware interpretation. Do not turn attestation presence into cryptographic verification, or make after-deployment evidence a prerequisite for permission to deploy.

Subsequent distinct work includes opt-in completion-time stream capture, new enforcement adoption, bounded production asset parity, durable remediation linkage and provider-backed assistance. Keep the existing acceptance matrix truthful about each.

## UX and retention intent

The interface makes accumulating history useful through concrete differences, explicit sample counts and inspectable reference decisions. One release is valuable for its actual scan; subsequent releases add context. We do not artificially delay exact comparison to create a milestone, invent prevented breaches, reward unsafe shipping frequency, make cancellation difficult or imply that exporting metadata publishes it.

Retention benefits remain hypotheses until observed. Measure repeat release coverage, useful-change review, reference adoption and investigation effort, not compulsory daily logins or fabricated monetary savings.

## Source-hash note

`SOURCE-HASHES.json` and the older `BROWSER-CHECKS.json` describe the original companion checkpoint. Runtime and ReleaseAssurancePanel have intentionally changed since that checkpoint. Do not restore the old files merely to satisfy a historical manifest. Generate a new commit-bound manifest after validating this continuation.

Prices, five-day trial, disclosure isolation, original scanner/worker safety controls and the branch-specific Vercel deployment guard remain unchanged. No main push, merge, provider activation, infrastructure purchase or customer/disclosure message is authorised by this continuation.
