# Release intelligence continuation

GitHub-free developer review is now a separate opt-in launcher: `npm run dev:review` → `http://localhost:4372/__dev-review`. Real integrated UI/API with synthetic connected GitHub/upload streams, memory database, separate session cookie, providers disabled and external redirects blocked. No change to normal4347 authorization or records. Review workspace IDs reset; use stable entry rather than old IDs. Six launcher tests and actual browser/HTTP verification in latest BUILD-LOG. Use the new four-agent continuation file for coordinated work without repeated remote polling.

Latest coordinated UI fixes: assurance failures no longer suppress independent history access checks; explicitly pending scans still wait. Parity/remediation/agent stale actions are removed after failed requests, including one-time agent credentials. Role/source/reference prerequisites remain real. Full core UI batch: 1,326 tests / 226 files passed; later dev-review launcher validation is separate. Remaining provider-backed explanations, provider-attested causal/deployment provenance, remote MCP OAuth and agency features are not merely hidden—they remain unbuilt. Read latest BUILD-LOG for boundaries.

## History discoverability and recovery (after 506a235)

The owner could not discover tools because an unlinked release showed only a collapsed creation form. The empty/unselected state now explains streams, comparisons, gate/remediation, optional outcomes/agent access and separate source/production prerequisites. Set up release history opens the existing form and focuses Name; it never creates data automatically. Identity-keyed panel state, fail-closed list errors and scoped export validation prevent stale controls/downloads after workspace changes or request failures. `releaseIntelligence.export` adds `scope:{workspaceId,streamId}`; old responses without that scope are rejected by the new downloader. Restart older local API processes when testing this additive contract; do not weaken the check. The real user server at4347 was inspected without changing records; synthetic creation/export verified at4371. See BUILD-LOG.

## Gate stale-state correction (after 37a89f6)

`ReleaseGateControls` is now identity-keyed to stream/record/refresh version; pending requests abort on replacement. Failed writes remove the stale view and consent; refresh uses WatchSkeleton. Historical decisions are labelled recorded, with expired/consumed/policy-changed states and no inactive override form. A deadline timer updates expiry without repeated polling. Server remains authoritative; no gate policy/permission semantics changed. Expanded real API tests cover unconsumed decisions after revoked token, wrong deployment/digest, viewer and foreign access. See latest BUILD-LOG for full/native/browser results. Continue the broader cross-flow acceptance matrix and optional model-provider contracts; do not rebuild completed core subsystems.

## Private monthly outcomes checkpoint (after 55c7982)

`ra_009_release_outcomes` and `release-outcomes-service.ts` add revisioned per-stream consent and on-demand retained-evidence summaries. `ReleaseOutcomeControls.tsx` is mounted in the shared release-detail panel, with month selection, clear next record action, fresh-authority unsigned download and one-click disable. Existing tokens cannot access the human-session summary API. Saved-history access/opt-out does not require renewed scan billing. No summary is sent or persisted as a new analytics archive.

Read `OUTCOMES.md` for UTC windows, limits, evidence validation and minimal derived event fields. Full suite 1,300 tests / 223 files; actual PostgreSQL and browser verification are recorded in BUILD-LOG. Next: close remaining integrated keyboard/role/error and lifecycle/concurrency acceptance across the release loop, then optional provider-backed explanation contracts without activation. Do not call on-ice enterprise features or later agency work implemented. Prior checkpoint “next” lists below are historical.

## Agent/MCP checkpoint (9 September 2026, after f1bab87)

The real release-detail panel now offers explicit administrator-managed agent access, revocation, recent calls and human-reviewed draft notes. `ra_008_agent_access`, `agent-access.ts`, fixed `agent-tools.ts`, `cli-mcp.ts` and `AgentAccessControls.tsx` connect seven bounded tools to existing verified evidence and remediation APIs. Credentials cover one stream for 24 hours/100 calls, read-only unless draft proposals are explicitly enabled. Existing scan tokens gain no access. Scope, current administrator/billing and connection lifecycle are checked; disconnected/reconnected grants cannot resume. Proposal acceptance is a human session action with revision checks and retains both original and edited text. Original scan evidence and security decisions are unchanged.

Read `AGENT-TOOLS.md` before changing this boundary. It records primary MCP references, the stdio-versus-private-HTTP distinction, metadata limits, audit/retention and cooperative cancellation limits. No model provider, sampling, external message, merge or deployment is activated. Optional provider-backed explanations/cost contracts and wider client/race/accessibility acceptance remain open. Retention outcomes are the next implementation increment; agency remains later. Check the newest BUILD-LOG entry for executed verification rather than importing historical counts below.

## Durable remediation checkpoint (9 September 2026, after 39ce185)

`streams/:id/remediation` GET/POST is integrated with the existing authorization, rate/CSRF/metadata guards and signed evidence adapter. `ra_007_remediation` stores original-snapshot/finding cases and append-only events. Actions: start (idempotent original finding), investigate, review, verify and reopen; revisions serialize on workspace identity. Only session users with current write authority may mutate; viewers can read, existing scan tokens cannot access human notes. Review requires HTTPS change URL, full commit, timezone-qualified review time and confirmation. Verification separately confirms that the recorded rebuild contains the reviewed change. Neither assertion is independently provider-attested; do not describe it as verified PR merge/causal provenance.

The deterministic check returns verified_absent / still_observed / unknown for the exact artifact and selected finding rule. It requires newer different bytes, equivalent source/channel/format/scanner/policy, no suppression/hold/inconclusive evidence and a scan within 24 hours. Signed full commit metadata, when present, must not contradict the review. Connected asset selectors must match; website production verification is separate. A path/title change with the same rule still firing is not remediation. Other findings do not disappear. Current reads recheck availability and freshness; previous evaluations remain labelled historical. Original receipt/alert state is never rewritten. Cases follow original evidence deletion; missing rebuilt evidence no longer supports a current observation.

The React control is in both existing release-detail mounts; select an original finding, add a human-reviewed change, record the new scan in the same stream and choose it under Check a rebuilt artifact. Existing Coverage PR tools are linked, not replaced. History-page selection bounds candidate choices; the API checks any explicitly selected compatible retained snapshot. The server inspects one selected case per read, listing at most 100 cases and 100 immutable events per case. Scope limits are explicit; no private source bodies, secret values or model calls are introduced.

Verification: full 1,279 tests / 217 files passed; typecheck/build/API build/lint passed with existing warnings. Native PostgreSQL upload and hosted exact-asset lifecycle passed. Built-app synthetic flow and desktop/mobile screenshots are in BUILD-LOG. These supersede earlier statements that durable remediation is wholly unbuilt. Provider-attested causal linkage and broader accessibility/race/operational acceptance remain open. Next: research current primary MCP/protocol docs, implement bounded read/write-separated tools over these evidence APIs, then retention outcomes. No provider activation, merge or deployment.

## Connected-source CI grant checkpoint (9 September 2026, after 34747bc)

`ra_006_gate_ci_access` and `release-gate-access.ts` add administrator-confirmed, 1–90-day grants for existing workspace tokens, bound to one stream and exact connected asset selector. GET/POST `streams/:id/gate-access` remain session-admin only. Only `streams/:id/gate` delegates the narrowly scoped capability; general history, receipt, repository, policy and override access are not broadened. Current administrator/source authority, token status, expiry and repository/package plus installation lifecycle generations are rechecked. Grant revisions bind decisions: renewal does not revive an old grant's decision. Grant revocation remains available without active billing where source/admin read authority remains. The migration enables nothing.

The connected CLI path uses `gate --release RELEASE_ID` in place of `--upload UPLOAD_UUID`; exactly one is required. Customers must first record the release and explicitly grant the existing workspace token access from Release Gate → Connected-source CI access. CI still must supply the exact digest, stream and deployment attempt, and explicitly call the gate. No pipeline or provider is configured automatically.

Verification: final runtime full suite 1,260 tests / 214 files passed; focused migration/access 23 tests passed; native PostgreSQL real session/token/CLI test passed. Typecheck, frontend/API builds and lint passed with existing warnings. Built-app synthetic QA port 4366 exercised token creation, release-stream creation, grant and mobile revocation; no horizontal overflow at 390/1365px or console errors. A final confirmation-copy correction has separate component/build checks (see build log). Remaining: wider concurrency/accessibility/operational acceptance, then durable remediation linkage, agent/MCP and retention outcomes. This supersedes older statements below that connected-source CI grants are unbuilt. Do not merge/deploy or activate customer policy.

Date: 8 September 2026. Branch: `codex/release-assurance-spine-v1`. Review container: draft PR #44.

## 9 September versioned gate increment

New `release-gate-{schema,service}.ts`, `release-intelligence/gate.ts`, `ReleaseGateControls.tsx` and `cli-gate.ts` connect explicit gate policy adoption, rollback, evaluation, reviewed override and one-use CI consumption. Migration `ra_005_release_gate` defaults to no adopted enforcement (advisory revision zero). Existing receipt and scanner policy are unchanged. The canonical assessment comes from the existing `assessRelease` implementation after HMAC verification, with stricter freshness applied separately.

GET `streams/:id/gate` returns current policy, optional recorded-build binding and bounded history. POST accepts `configure`, `evaluate`, `override` or `consume`. Configure/override require an active administrator, confirmation and reason. Tokens may evaluate/consume only evidence already available under their existing independent-workspace scope. Policy revision, digest, record, deployment attempt and five-minute expiry are enforced; consumption is one-use and rechecks current evidence/authority. Unknown/stale evidence and holds cannot be overridden. Overrides preserve blocked/review status; original signed evidence never becomes clean because permission was granted.

After the existing scan-and-record workflow, an independently scoped upload can be checked immediately before deployment:

```sh
npm run nospoilers -- gate --api https://YOUR-APP-HOST \
  --stream STREAM_UUID --upload UPLOAD_UUID \
  --digest EXACT_ARTIFACT_SHA256 --deployment DEPLOYMENT_ATTEMPT_ID
```

Set `NOSPOILERS_TOKEN` through CI secrets, never committed files or CLI arguments. Gate exit 2 means deny/error; exit 0 in advisory/warn means **not enforced**, not a passing security result. Original `scan` exit semantics are untouched. To consume a separately reviewed, unexpired UI decision, supply `--decision DECISION_UUID` with the same upload/digest/deployment binding. A previously consumed denied decision cannot be overridden; evaluate a new attempt for review. Enabling enforce in the UI does not modify external CI automatically. Existing tokens still cannot inspect connected GitHub release streams: scoped connected-source CI capability remains unbuilt, not silently granted.

Local connected tests cover Hono/session/token/HMAC, viewer/foreign/CSRF rejection, competing revision saves, concurrent single-use consumption, idempotent evaluation, stale policy/decision expiry, stale evidence, override denial for unknown, explicit blocked override, token revocation, CLI consumption and immutable receipt/deletion linkage. Native PostgreSQL gate and production-observation race scenarios passed; exact source boundaries, final full-tree results and synthetic browser details are recorded in BUILD-LOG. Provider-attested deploy provenance, wider governance races, full keyboard/role UI acceptance and operational CI rollout remain open. Durable remediation, agent/MCP and retention outcomes follow.

## 9 September bounded production-observation increment

Final local tree: 209 files / 1,252 tests passed on Node 24.19.0; typecheck, frontend/API builds, lint (warnings) and diff validation passed. Native PostgreSQL and integrated synthetic browser scope are recorded in BUILD-LOG. DNS cancellation is covered; broader mid-flight authority/lease races and keyboard/role/error acceptance remain next, followed by versioned opt-in release enforcement. No production acceptance is implied.

`production-parity-schema.ts` adds `ra_004_production_parity`. Each run binds the stream, adopted reference revision/snapshot, signed receipt fingerprint, verified origin generation, declared deployment ID/time and explicit manifest-to-public-path mappings. Binding fields and terminal results are immutable; original evidence deletion cascades. No new baseline, receipt, scan verdict or enforcement policy is issued.

GET/POST `/api/release-intelligence/streams/:id/production-parity` lists scope/results, queues a confirmed observation or cancels one. Queueing requires an active administrator and current verified source. The existing scan payer/allowance is reserved immutably at job creation; retries reuse request identity, and cancelling an unstarted job refunds its reservation. The worker uses existing job claiming and checks access, reference revision, origin generation and lease before/after work and between requests. Cancellation/lost-lease polling aborts transport. No provider or cron is automatically enabled.

The observer reuses pinned HTTPS, public-address checks, bounded body reads, HTML discovery and cache normalization. Limits: 40 requests/assets, 2 MB/file, 20 MB charged byte budget (failed reads retain their reservation), 30-second deadline, three redirects, one origin with ownership verified within 30 days. Only identity bytes are compared; compressed/transformed responses and off-origin redirects are unsupported. Unmapped manifest files remain unobserved. Extra means a fetched same-origin HTML asset reference outside the selected mapping, not malicious content or proven absence from every other artifact.

`ProductionParityControls.tsx` mounts in the existing history panel on both detail contexts. It requires explicit paths/deployment confirmation, shows historical authority loss and server-calculated stale state, and shares one manifest suggestion list. Deployment ID/time are customer declarations, not provider-attested provenance. Observations are separate from before-deploy readiness.

BUILD-LOG records API/store/worker tests, the synthetic browser queue→worker→mismatch result, mobile/console checks, full suite and native PostgreSQL. Outstanding: broader mid-flight revocation/lease/concurrency tests, full keyboard/role browser acceptance and operational rollout. Versioned enforcement, durable remediation, agent/MCP and retention outcomes remain unbuilt.

Automatic capture now preserves stop controls when seed evidence is missing/invalid, with a final access recheck. Competing grant saves, expired-plan disable and original-upload deletion relationships are tested; hosted append-only restrictions remain unchanged.

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
