# Gate B completion audit

## Local integration and continuation — 8 September 2026

Verification recovery: the subsequent full-run session 9422 and its wrapper became unavailable after conversation interruptions; its terminal result was not recovered and must not be called a pass. The earlier completed 862-test PR run below remains valid for that snapshot. The later Coverage correction has separate focused/build evidence. Owner clarified that all B0–B8 have substantial implementation: Open rows represent remaining gaps/acceptance, not instructions to rebuild completed sections.

PR #41 (`a50ea7007efbc3660aace91131cf4ff4784fbecd`) was reviewed in a separate checkout and fast-forwarded into the local working branch after **862/862 tests across 185 files passed** (242.34 seconds), together with semantic typecheck and production build. `backup89` remains at `eb46118`. No remote merge or deployment was performed.

The GitHub CI failure is now explained: check-run 102022502098 reports that the job did not start because recent account payments failed or the Actions spending limit needs increasing. This is an account-side blocker; local test success does not change that remote check result.

Subsequent B3 correction: Coverage now selects release evidence by the scanner's exact typed source coordinate instead of partial name matching. Similar package/repository names and different source kinds cannot supply another source's latest-release link; website URLs preserve protocol/path distinctions; latest selection is timestamp-based and leaves history order intact. Eight focused tests across three files and the production build/typecheck pass. The 862-test result predates this correction and is not a full-suite result for the later source.

Local review server restarted at `http://127.0.0.1:4347` with role `web` (background jobs disabled). Browser sign-in successfully reopened the existing personal workspace and real saved scan evidence. This verifies local login/Overview only, not connected Coverage lifecycle acceptance. Remaining work is still the B0–B8 ledger below; next is connected-source lifecycle parity and rendered Coverage/selected-release navigation.

Owner's latest authorisation permits local integration and continued Gate B implementation; the review-branch-only publication boundary recorded below describes the earlier ChatGPT handoff, not a prohibition on this authorised local integration.

## Current checkpoint: 8 September 2026

**Gate B remains incomplete. All B0-B8 acceptance rows remain open.** This checkpoint implements bounded B1/B3 evidence-presentation corrections, not the entire continuation prompt or launch acceptance.

Source branch: `codex/v20-homepage-auth-mock3` at `eb46118030643a8f27847302784867df4e84c6da`.
Review branch: `codex/gate-b-evidence-integrity-20260908`.

The complete previous audit is preserved without content changes in [GATE-B-COMPLETION-AUDIT-2026-09-06.md](GATE-B-COMPLETION-AUDIT-2026-09-06.md). It contains the historical checkpoint chronology, implementation references and earlier browser evidence. Its top checkpoint recorded full run 83464 as 806/814, with targeted follow-ups, not a clean final acceptance run. Historical local process IDs and test reports have not been reproduced in this environment.

### Implemented in this checkpoint

- Coverage no longer treats an empty package-version coordinate as a wildcard matching every unrelated alert. Missing/whitespace coordinates are excluded; acknowledged findings remain open, resolved findings are excluded and a matching alert is counted once.
- Server-provided unknown or unrecognised freshness can no longer leave an otherwise successful source green. This applies to GitHub, npm, websites and private map custody. Critical findings and warning/error/pending states remain visible. Delayed sources still appear in the attention filter; saved results/timestamps and explicitly unknown next dispatch remain unchanged.
- Setup no longer treats a crawl timestamp alone as successful inspection. Positive inspection requires a valid recorded timestamp and an explicit successful status, or the existing recorded-public-map findings path. Inconclusive, error, running, queued and unrecognised outcomes cannot become completed crawl proof solely because a timestamp exists.
- Map custody uses exact positive statuses (`passed`, `verified`, `match`), not substring matching that accepted `unverified` or `mismatch`. `passed` is emitted by the existing map-custody evaluator. Missing/invalid timestamps and lookup errors cannot verify custody. Recorded setup capability is distinct from a clean release verdict: where public-map evidence remains, setup copy explicitly says exposure still needs action and Coverage stays critical.

The changes stay inside the existing view-model layer and preserve the current screens, routes, API contracts and approved four-circle journey. There is no new feature, authentication provider, migration or customer-data insertion.

### Fresh verification and its limits

`tests/watch-evidence-integrity.test.ts` adds 42 regression cases. The actual view-model and server freshness functions were executed locally under Node 22.16.0 with native TypeScript stripping. For this focused standalone run only, the test-framework import was changed from `vitest` to `node:test`; the assertions and cases were unchanged. Imported runtime helpers were retrieved from the repository, not mocked.

- Original source: **12 passed, 30 failed** across the new 42 cases.
- Patched source: **42 passed, 0 failed** against unchanged application source after the patch.
- TypeScript transpilation syntax checks passed for the changed view model and the new test file. This is not a semantic project typecheck.
- Git blob hashes of the uploaded source and test match the locally executed files.

The environment has no complete local checkout/dependency installation and cannot resolve GitHub/npm network hosts. Consequently **the full Vitest regression, semantic project typecheck, production build and rendered browser/API journeys are not locally verified**. The existing GitHub CI workflow now also runs `npm run build` after the full test command; build/test results must be read from the PR checks and must not be inferred from the focused run. Do not edit source/tests while that full run is active.

To reproduce with the normal project dependencies: `npm test -- tests/watch-evidence-integrity.test.ts`, then `npm test`, `npm run build`, and the applicable real browser/API acceptance journeys. Do not create external credentials, notifications or customer fixtures to exercise a screen.

### Complete acceptance ledger

The inherited implementation evidence below is historical, not fresh proof for this branch. No row is closed by the focused tests.

| Requirement | Inherited implementation evidence | Remaining proof/work | Status |
| --- | --- | --- | --- |
| B0 identity/workspaces | Workspace membership/billing, fresh GitHub binding, website ownership and stable assignment migrations | Full resource ownership and mixed-source acceptance; provider activation remains deferred | Open |
| B1 First Proof/setup | Four-circle empty state, saved artifact transition; this checkpoint corrects crawl/custody evidence predicates | Full evidence-driven intermediate states, diagnostics and rendered acceptance | Open |
| B2 New Scan | Durable uploads/login claim, GitHub intent/binding, independent website challenge/admission/saved results | Complete source-type, permission, cancellation, retry, expiry, trial and navigation matrix | Open |
| B3 Coverage | Independent website lifecycle/schedule/health, retained disconnection, cadence and ownership fields; this checkpoint corrects alert/freshness presentation | Lifecycle and scheduling parity across source kinds, exact source attribution, successful-check semantics and rendered acceptance | Open |
| B4 Releases/detail | Saved selection, preview/detail, pagination and immutable uploaded evidence | Full source/type/state parity and browser reload/back-forward verification | Open |
| B5 Alerts/exceptions | Website publication, workspace responses/history, stable assignment, pagination and scoped exception/snapshot enforcement | Populated response, approval/denial/expiry and mixed-source browser acceptance | Open |
| B6 Proof | Private records and explicit redacted publication/revocation | Complete outcome taxonomy and upload races across proof types, no scan-job side effects and rendered verification | Open |
| B7 Daily Overview | Saved-scan totals, website health/filter links and mixed-workspace First Proof transition | Correct connected aggregation and evidence-driven intermediate states with browser acceptance | Open |
| B8 Settings | Team/policy/retention/audit; independent tokens/notifications and connected APIs | Rendered save/error/audit and permission acceptance across workspace types and lifecycle boundaries | Open |
| Cross-cutting acceptance | Historical suites in the preserved audit; 42 fresh focused regression cases in this checkpoint | Fresh full regression/build plus actual API/browser, isolation, access-revocation and failure-state matrix | Open |

Known limits of this slice: legacy source-coordinate matching still uses non-empty substring fallback rather than authoritative source IDs; omitted monitoring metadata retains existing compatibility behaviour; setup capability evidence is not whole-workspace safety or source-attributed custody proof. These must not be represented as complete tenant-isolation or current-clean acceptance.

### Next authorised work and owner boundaries

Resume the original Coverage lifecycle/scheduling and rendered cadence checkpoint, then the complete matrix in [CONTINUE-GATE-B-PROMPT.md](CONTINUE-GATE-B-PROMPT.md) and [ENTERPRISE-READINESS-PLAN.md](ENTERPRISE-READINESS-PLAN.md). Revalidate against actual code; the preserved audit's historical defects are not automatically still current.

Only this new review branch and a draft PR are authorised for publication. Do not push to `main`, rewrite the source branch, merge, deploy, migrate production, install Docker, activate providers, create paid resources or send external notifications. `vercel.json` disables automatic deployment for this review branch only; other branches' settings are unchanged. CI uses read-only repository permissions and tests/builds local fixtures, not live deployment.

Gate A hosted isolation, Gate C broader visual/accessibility work, Gate D enterprise capabilities and Gate E operational/commercial readiness remain separately deferred as already agreed. Disconnect retains history; destructive customer-data deletion still requires the lifecycle policy's explicit typed authorisation. A passing focused suite, or even passing CI, is not a whole-application launch declaration.
