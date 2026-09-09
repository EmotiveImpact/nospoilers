# Build and verification log

## 9 September 2026 — connected bounded production observation (after 511c78a)

Implemented `production-parity-{schema,service,worker,observation}.ts`, real intelligence API routing, heavy-job dispatch and `ProductionParityControls` inside release intelligence. Migration `ra_004_production_parity` preserves immutable bindings and finished observations. Customers explicitly select an adopted signed manifest, a currently verified origin, declared deployment identity/time and exact public paths. This uses the existing scan allowance; replay is idempotent and cancelling an unstarted job refunds its reservation. No deployment provenance is inferred from a customer-entered identifier.

The worker checks source/reference/origin authority before and after network work and between requests, monitors cancellation/lease loss, uses pinned safe transport, and records matched/missing/extra/mismatched/unobserved/unsupported outcomes. Limits: 40 requests/assets, 2 MB per response, 20 MB charged budget, 30-second observation deadline and three same-origin redirects. Failed reads retain their budget reservation. Compression/transformation is unsupported, not silently compared. A final DNS-cancellation repair bounds waiting for lookup answers; an underlying OS lookup may finish later but cannot resume the observation's requests. Bodies are discarded after hashing/discovery. Results do not change the before-deploy scan verdict or issue a receipt.

Automatic-capture controls also recover when seed evidence is missing, preserve disabling after entitlement expiry, and recheck current access. Real integration tests cover competing revisions, missing seed evidence, expiry, cancellation/refund, immutable finished observations and parent-upload deletion cascades.

Verification on supported Node 24.19.0: full regression before the final DNS repair passed **209 files / 1,251 tests**, 272.36 seconds. After the DNS repair, focused observation/UI/connected integration passed **20 tests / 3 files**, 4.58 seconds. Final `npm test` passed **209 files / 1,252 tests**, 254.40 seconds. Typecheck, frontend build, API build, lint (warnings, no errors) and diff validation passed. The frontend bundle-size warning remains. Locked dependencies are unchanged; the prior locked install remains the dependency checkpoint, not a new install claim.

Disposable native PostgreSQL: hosted capture case passed (1 selected, 1 skipped; 2.66 seconds), and independent website/parity case passed (1 selected, 1 skipped; 2.21 seconds), including immutability and deletion assertions. These preceded only the DNS repair. Database stopped and temporary data removed; no Docker or production migrations.

Integrated production-build browser at isolated port 4364, synthetic data and outbound network disabled: created a real stream, adopted a reference, submitted a mapped observation and ran the real worker through a QA-only synthetic transport. The stored mismatch, unmapped-file count and cache state appeared without replacing the original passing pre-deploy verdict. At 390px there was no horizontal overflow; no console errors. Local screenshots: `output/playwright/parity-completed-desktop.png` and `parity-completed-mobile.png`. These precede the server freshness-label adjustment and DNS repair; they prove the connected flow, not live website verification. Broader keyboard, role/error and mid-flight race coverage remains open.

Still unfinished: provider-attested deployment identity, broader parity races, versioned opt-in release enforcement, durable remediation linkage, agent/MCP and retention outcomes. CI was previously blocked by account billing before runner steps; this is not a green CI claim. Branch deployment guard is retained; no merge, deployment, provider activation or production mutation.

## 9 September 2026 — automatic capture work in progress after 085ac46

Publication checkpoint: full regression passed **207 files / 1,234 tests**, 271.83 seconds, supported Node 24.19.0; frontend build, API build, typecheck, lint (warnings, no errors) and diff validation passed. This full run precedes only the final test-harness correction to use `store.claimJob` rather than raw job SQL. That correction was prompted by native PostgreSQL's bigint representation and exercises the production conversion/claim path; no runtime validation was weakened. The corrected integration file passed **2 tests**, 3.26 seconds: its hosted case used disposable native PostgreSQL, its independent website case used PGlite. A subsequent typecheck passed. The native server was stopped after verification.

Built-app browser evidence at isolated port 4363 (outbound network disabled): a real hosted release stream was created, exact-artifact capture enabled with confirmation/reason and disabled at 390px. Disclosure remained open, saved history stayed visible, no horizontal overflow and no console errors. Synthetic-only screenshots: `output/playwright/auto-capture-enabled.png`, `auto-capture-mobile-disabled.png`, and startup `auto-capture-start.png`. No worker runs in that browser fixture; actual publication/worker outcomes are covered by integration tests, not claimed as browser evidence. Broader keyboard/role/error cases, native concurrency/deletion and missing-evidence control recovery remain open. This is an incremental implementation checkpoint, not platform completion.

Uncommitted implementation connects opt-in exact-source capture rules to GitHub, npm, hosted website and independent-workspace website completion paths through durable light jobs. The React controls require explicit selection confirmation and a reason; disabling does not require enable permission. Reference adoption remains separate. This is not yet an accepted/published increment: source lifecycle, retry/concurrency, native PostgreSQL, integrated browser and full final-tree checks remain outstanding.

Executed during this continuation on Node 24.19.0: automatic-capture controls, connected integration and existing intelligence DB tests passed **26 tests / 3 files**. After adding the independent-workspace website completion test, the two automatic-capture files passed **5 tests / 2 files**. The new test exercises real website scan completion and the actual history worker with a synthetic verified origin and no GitHub installation. Its initial fixture used an invalid non-UUID upload reference and returned 400; the fixture was corrected to the actual reference contract, not by loosening validation. Typecheck and diff validation passed before that fixture-only correction. No full-suite or browser result is claimed for this worktree yet.

Capture-settings errors no longer retain a false loading message. Component tests cover opt-in confirmation/revision payload, retry after failed settings read, disclosure persistence and disable controls when enable permission is absent. All results are local synthetic evidence; no customer configuration, provider activation or production migration occurred.

Final focused run for this work session: **28 tests / 4 files passed** in 17.19 seconds (`automatic-capture-controls`, `automatic-capture-integration`, `release-intelligence-db`, `release-intelligence-integration`). Added a transactional failure injection at the snapshot write: rollback preserves the prior history, the attempt reports a sanitized retryable failure, and a subsequent real worker invocation captures once. Added website pause/resume generation invalidation: queued capture stops under the old grant. Typecheck passed; targeted lint returned no errors with four React effect-state warnings; diff validation passed. This remains uncommitted pending the broader acceptance checks, not a claimed remote or production result.

## 9 September 2026 — canonical readiness cutover (after f2e7ba1)

Final tree checks: `npm test` passed **205 files / 1,229 tests** in 266.59 seconds on Node 24.19.0. Typecheck, frontend build, API build, lint (warnings, zero errors), and diff validation passed. The updated real-composition integration test also passed on disposable native PostgreSQL (one test, 644 ms), covering the new bounded authorised batch query and tampered-receipt regression. The database was stopped and its temporary data removed. No production evidence is inferred from these results.

`src/server/release-assessment.ts` now projects the existing `assessRelease` contract from HMAC-verified saved evidence. Hosted detail and list APIs, upload detail/list APIs and the token scan response expose scoped readiness without changing the original scan outcome or activating enforcement. Hosted list receipt reads use an authorised batch capped at 100 IDs, 8 MiB per receipt and 16 MiB total; unavailable evidence yields UNKNOWN, not a fabricated pass.

Legacy hosted/upload heroes consume that assessment. Attestation presence no longer becomes verified identity; post-deployment observations do not block the before-deploy verdict. The React supporting panel no longer duplicates the main decision; a what-if decision appears only inside its explicit preview. Refresh success updates the main decision, and refresh failure clears the inferred readiness. Existing receipt outcome filters remain historical scan filters, with connected-list wording clarified.

New regression coverage compares real hosted detail/list assessments to the assurance endpoint, rejects tampered signatures despite stored passing status, verifies upload signature handling, covers all four presentation decisions, and checks the separate delivery/attestation semantics. The refresh UI case verifies a single visible heading and loss-of-access transition to unknown. The first full cutover run passed 205 files / 1,228 tests; a final run follows the supporting-panel and refresh-case changes and must be recorded separately.

Integrated production-build UI on disposable in-memory QA port 4362: uploaded failing evidence showed one blocked decision; hosted clean evidence showed one scoped pass; both had zero console errors. Hosted mobile at 390px had no document overflow. Real hosted stream creation, explicit reference adoption and revocation succeeded; revocation did not reinstate an older reference or rewrite the original scan. Local screenshots (not customer evidence): `output/playwright/readiness-upload-desktop.png`, `readiness-hosted-mobile.png`, `readiness-reference-adopted.png`. The reference controls collapse after a successful history refresh; preserving that disclosure/focus state is still a polish item. Full keyboard/reduced-motion and other lifecycle cases remain open.

This increment does not implement automatic capture, parity, enforcement, remediation linkage or agent tools. CI billing restriction and operational gates are unchanged. No production mutation, provider activation or deployment.

## 9 September 2026 — integrated branch repair

Increment based on `a4a3e10`, preserving the existing release-intelligence implementation. Extracted the universal assurance-view validator from browser download code; corrected strict API test decoding and unused test bindings. Fixed package-mode navigation and staged-claim workspace/install preservation, contextual skeleton accessibility, and the stream-key HTML validation pattern. The disposable browser fixture now composes both real assurance/intelligence wrappers and accepts an isolated port.

Added `tests/release-intelligence-integration.test.ts`: real Hono composition, stores, signed scanner receipts and migrations, with session/token/source isolation, revoked access, expired billing, signature rejection, concurrent reference adoption and private export assertions. Ran it with PGlite and a disposable native PostgreSQL database; both passed. The PostgreSQL instance was stopped and its temporary database files removed. No Docker or production database was used.

Supported bundled Node 24.19.0: locked `npm ci` passed. Full `npm test` passed **205 files / 1,222 tests** (267.83 seconds). The final HTML pattern-only correction followed that run; no broader completion claim follows from this count. Earlier focused native cases passed 210; the focused scan/team suite passed 28. Typecheck, lint (warnings, no errors), frontend and API builds passed during this increment; final post-pattern build checks are recorded in the commit handoff when complete.

Integrated disposable-browser evidence: stream creation saved the initial signed record, a failing release could not be adopted as an approved reference, and exclusion preserved original findings. Remaining browser coverage includes complete hosted/upload reference lifecycle, retry/conflict, keyboard and reduced-motion checks. This is partial integrated UI evidence, not a completed browser matrix.

GitHub Actions is externally blocked before steps start: the check annotation reports failed account payments or an increased spending limit is required. No billing changes or check bypass were made. Canonical readiness reconciliation and RA-02 through RA-08 remain open; no merge, deployment or provider activation.

Final post-pattern checks also passed: `npm run typecheck`, `npm run build`, `npm run build:api`, `npm run lint`, and `git diff --check`. Lint reports warnings, and the frontend retains its bundle-size warning; neither is represented as warning-free. The full regression count above precedes only that HTML pattern correction and documentation updates.

8 September 2026. Started at main `675916b4b9b843bff2cb0651ec13034f2f62775d` and created isolated branch `codex/release-assurance-spine-v1`.

Bootstrap: consolidated duplicate Vercel `git` configuration keys, preserved both existing branch guards, disabled deployment for this branch before publishing product changes. Added a contents-read-only review workflow. No production migration, provider activation, customer notification, merge or push to main.

Repository review: Gate B's final matrix is newer than the older STATUS/ROADMAP wording and records complete acceptance of that earlier work. Original source boundaries and three exact file hashes were verified before additive patches.

Implemented: scoped receipt interpretation, stable-source comparison, after-deployment freshness, deterministic guidance, stricter-review simulation, private unsigned passport, read-only API composition and native/React release-detail integration. The acceptance matrix records the rest of the vision as separate work.

Local verification after final logic edits:

| Check | Result | Boundary |
| --- | --- | --- |
| Shared native Node domain/API cases | 101 passed, 0 failed | Actual new functions/handler; injected auth/read/signature ports |
| Native browser renderer | 55 passed, 0 failed | Four synthetic states at three widths plus interactions; not full React/API |
| Strict TypeScript 5.8.3 subset check | Passed | Dependency-free source/handler/cases only; repo pins TS6 |
| Source transpilation syntax | 15 files passed | Not semantic React/Hono validation |
| Initial GitHub Actions | Failed before test steps | Review run 34268285866; original CI 34268285788; cause unconfirmed |
| Full pinned suite/build/lint | Unverified in this runtime | Complete checkout/dependencies unavailable |
| Live production scans / worker isolation | Not run | Separate operational gates |

The browser harness exercised keyboard disclosure, reversible preview/focus, actual JSON download, malicious filename escaping, unknown/stale scope, reduced motion, lifecycle cleanup and document overflow. See `BROWSER-CHECKS.json` and the reproducible scripts. Synthetic fixtures do not imply customer adoption or production results.

Known limitations and next steps are in HANDOFF.md and ACCEPTANCE.md. Do not turn these results into “all features complete”, “all tests pass”, “full security audit” or “ready for production”.
