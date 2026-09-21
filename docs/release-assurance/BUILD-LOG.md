## 21 September 2026 — release-candidate integration and hosted fail-closed safeguards

Integrated the current local product work into one release-candidate source set. Overview now distinguishes saved release evidence that needs review from generated alerts that need a response. Alerts is the response inbox only: its empty state points saved scan evidence to Releases and missing-release coverage to Coverage/history. The queue tabs retain the shared dark switcher treatment. Existing retained records are not deleted or reclassified; this is a customer-facing navigation and terminology correction.

The notification outbox now covers future connected-GitHub workspace alerts as well as independent workspace alerts. Migration `122_connected_workspace_notification_outbox` is future-only and does not enumerate or send historical rows. Delivery remains workspace-scoped, generic/private, idempotent for GitHub retries and dependent on an explicitly configured provider.

Added a fail-closed hosted-worker preflight and made Railway start through it. Production worker startup now rejects missing external Postgres, hosted HTTPS origin, complete GitHub App/OAuth configuration, strong distinct secrets, immutable scanner image identity, container mode, enabled local bypasses, missing notification delivery and the absence of the required worker-local clean-scan mount probe. Stripe is deliberately outside this worker preflight. The current Railpack service does not provide the required local container executor/image, so the preflight correctly blocks it until that infrastructure exists. Runtime shutdown now attempts every registered closer before reporting one or multiple failures.

Verification on the frozen source over `f85fae1`:

- unrestricted `npx vitest run`: **1,643/1,643 tests in 269 files passed** (277.87s); the preceding restricted run's seven failures were all local listener/CLI sandbox denials and passed in the unrestricted complete run;
- `npm run typecheck`: passed;
- `npm run lint`: exited 0 with 33 warnings and no errors;
- `npm run build`: passed, with the existing chunk-size advisory;
- `npm run build:api`: passed;
- final Overview and Alerts browser console review: no warnings or errors.

The signed-in local browser showed real saved scan data on Overview, two release reviews, zero response alerts and the clarified route ownership. Alerts showed zero in all response queues, the dark selected switcher, the explanatory empty state and an Open Releases action. No scan, response, payment, provider activation or external message was submitted.

Local mockup studies and browser artifacts remain outside the release candidate. The remaining launch blockers are hosted Railway scanner-executor acceptance, fresh hosted GitHub sign-in through saved result, configured notification delivery, GitHub Actions account billing/spending-limit recovery, native 200% zoom and audible screen-reader execution. Stripe checkout/webhook acceptance is explicitly deferred by the owner. No deployment or merge is claimed.

## 21 September 2026 — Railway to Vercel Sandbox isolation adapter

The release candidate and PR44 are now merged to `main`; the Railway Railpack duplicate-install correction is also on `main`. A dedicated Railway worker and external PostgreSQL service are provisioned. Railway cannot provide privileged Docker-in-Docker, so production scan execution now has a reviewed second isolated mode: the persistent Railway worker uses `@vercel/sandbox`3.3.0 to create one fresh Vercel microVM for each untrusted artifact. The owner selected a fresh Vercel account/project; the prior account must not supply this deployment's project identity or token.

The adapter accepts only a project-local repository or fully qualified VCR reference pinned by sha256 digest. It creates a nonpersistent, deny-all-network, one-vCPU session without forwarding Vercel/application/database/GitHub credentials into the VM. `Dockerfile.scanner` creates uid/gid65532 and starts the parser as that user. The worker verifies that identity, rejects symlinks/special files, enforces80MiB/25,001-entry input and32MiB report bounds, uploads files0444, seals the input tree to root ownership, keeps the parser Node heap at512MiB, layers90/100/105/135-second deadlines and requires sandbox stop after success or failure. Production and hosted preflight reject process mode. Existing worker-local container execution remains available and its stronger Docker-specific capability/PID/root-filesystem controls are not misrepresented as Vercel API features.

Verification on the final source: `npx vitest run tests/vercel-sandbox-scanner.test.ts tests/hosted-worker-readiness.test.ts tests/gate-a.test.ts` passed28/28 across3 files; `npm test -- --maxWorkers=2` passed **1,654/1,654 tests across270 files** in325.61s with normal subprocess/loopback access and two non-failing tar locale messages; `npm run typecheck`, `npm run build`, `npm run build:api`, `npm run lint` and `git diff --check` passed. Lint retains the existing warning set and Vite retains the existing chunk-size advisory.

Gate A remains open. The fresh Vercel project, project-scoped token and scanner VCR digest are not yet configured, so the Railway worker stays fail-closed. Required live acceptance covers exact digest/uid boot, denied egress, hostile symlink/special/oversize inputs, command/session/resource termination, cleanup after success/failure/worker interruption and one private hosted GitHub sign-in→repository→scan→saved signed result plus destination delivery. Artifact bytes necessarily transit the selected Vercel Sandbox provider boundary. Stripe remains owner-deferred.

The fresh Vercel Hobby project import exposed the repository's legacy hourly `/api/cron/jobs` declaration. Removed that duplicate schedule rather than reducing it to a misleading daily backstop: the persistent Railway worker already owns the hourly GitHub visibility poll, stale-job recovery and PostgreSQL job notifications. The authenticated cron endpoint remains available for explicit operator use, but normal Vercel deployment no longer requires Cron Jobs or `CRON_SECRET`.

## 19 September 2026 — final-pass Overview, Releases, Alerts and Scan

Applied the owner-selected mock 39/final-pass direction to the real signed-in Watch app while preserving the existing shell, workspace isolation and saved evidence. Overview now ranks real failed attempts and recorded findings ahead of passing scans, separates failed attempts from completed release attention, uses recorded finding severity, and avoids presenting coverage or production state as verified release proof. Releases now has coherent **Recorded releases**, **Connected releases** and **Attempts** collections; upload filtering happens before pagination, selected evidence exposes artifact/production lanes, and website proof remains pending or unavailable unless a completed report exists. Scan uses the shared Radix-style repository picker and explains that connected repositories are already watched before offering an explicit re-check.

Alerts now excludes `scan_latest_release` “No release on …” coverage reminders from the actionable queue without deleting them. Counts and paging are computed over actionable rows, while **Export retained history** returns the complete workspace-scoped record, including coverage reminders. Queue rows use concise human labels, finding severity comes from every retained finding rather than rule-prefix guesses, and per-finding detail retains its own severity. Deep links to filtered-out coverage reminders do not revive response controls.

Verification used the preserved local PGlite database, signing state and GitHub connection. The restarted signed-in app at `http://127.0.0.1:4347` was inspected on Overview, Releases, Alerts, Scan and Coverage. It showed the real three saved passing builds, one failed attempt, 88 connected sources and an empty actionable alert queue after removing the 22 no-release reminders; document width equalled viewport width on every inspected route. No scan, response, export, billing or provider action was submitted.

Current-source checks: 73/73 product-focused tests across 11 files; 63/63 loopback/CLI integration tests across four files outside the restricted sandbox; 22/22 coverage/security/architecture contract tests after synchronising stale test fixtures with the current shell; `npm run typecheck`; repository lint exit 0 with the existing warning set; final `npm run build` with the existing chunk-size warning; and `git diff --check`. The first complete-suite attempt found 11 failures: seven were loopback processes blocked by `listen EPERM`, and four were stale static/test-fixture contracts. Every reported failure was rerun in the targeted groups above and passed; the complete suite was not repeated solely to avoid another costly duplicate run.

This is a connected UI/workflow increment, not deployment, Railway worker acceptance, native 200% zoom, audible screen-reader evidence, optional-provider activation or full Gate C completion.

## 16 September — stable tab transitions and shared chrome

Removed topbar Guide and account avatar; explicit sign-out remains in sidebar footer. Active sidebar icons are red. Shared tab type is 12px medium, page title/lede typography and Scan/Alerts top spacing aligned. Coverage/Alerts/settings content uses restrained 140ms opacity reveal with reduced-motion opt-out.

Root flash cause: shared bootstrap depended on the full URL search and route, resetting all datasets for local filter/tab changes. It now depends on installation/connection identity, with current navigation location retained for default-install redirects. Explicit refresh and scoped server checks remain. Alerts no longer remounts for queue changes; it retains the displayed queue until the requested queue arrives and blocks responses during that transition. Deferred-response regression verifies that behavior. Pending errors still clear/disable evidence.

Validation: final build passed (existing chunk warning), 16 focused tests across workspace-alerts-ui, artifact-shell-navigation, coverage-detail-ui and alert-response-permissions-ui passed cumulatively. Signed-in browser switched Coverage to Packages (counts retained; all tab fonts12px; active icon rgb226,69,58), and Alerts to In progress. Topbar has Search/New scan without Guide/avatar; footer sign-out present. No response/scan/payment submitted. Other dirty CSS/mockups preserved. No full-suite or deployment claim.

## 16 September — consistent active underlines

Added shared red active-tab/queue/evidence underline styling and corrected Coverage’s specific override. Scan, Alerts and Settings already use the same #e2453a. Existing unrelated index.css edits preserved. Build passed (existing chunk warning); signed-in Coverage computed selected underline rgb(226,69,58). No behavioral change or full-suite rerun.

## 16 September — focused navigation, billing access and alert loading

Main sidebar now contains daily workflow links and Settings. Settings routes expose scoped local navigation with existing role visibility. Footer replaces setup progress with Plan & billing, Help & guides and account/workspace access. Billing links directly to workspaceTab=billing and reuses authorized organization billing; prices and the host’s actual checkout availability are shown. Settings links reset that billing subtab, and active settings underlines are red. No payment, provider activation or production deployment occurred.

Alerts no longer render transient unavailable/read-only copy or empty related-release/recheck panels during loading. Same-record background refresh preserves the loaded detail state; failures still clear evidence/disable response. Re-selecting the current alert no longer leaves response controls waiting for the next refresh. Added deferred detail test verifies pending evidence cannot enable acknowledgement or flash unavailable guidance.

Focused checks cumulatively: 41 tests across workspace-alerts-ui, alert-response-permissions-ui, alert-related-releases-ui, alert-recheck-ui, artifact-shell-navigation, workspace-management-ui, organization-billing-ui passed. Related-release screen-reader loading status was preserved after its existing test caught its removal. Workspace tab expectation updated for intentional billing tab. Final build (tsc + Vite) and final changed-file tests (25/25) passed; existing chunk warning remains. Signed-in browser checked selection, sidebar, direct billing, default Settings URL, prices and disabled local checkout (Stripe not configured). Unrelated src/index.css and historical mockups remain unstaged. No full-suite repeat or full-platform acceptance claim.

## 16 September — Scan reference accents and explanation icons

Restored red selected-tab underlines for Scan and Alerts, and added file, lock and shield icon tiles with concise descriptions to both GitHub and upload scan explanations. No scan behavior changed. npm run build passed (existing chunk warning); diff check passed. Signed-in browser verified three rendered icons and selected Scan underline rgb(226,69,58). Sidebar regrouping and billing discoverability remain recommendations, not implemented by this visual patch.

## 16 September — Alerts response placement (base a77b724)

Reviewed signed-in Alerts alongside the approved journey mock. Moved Resolve from the top action bar to the required resolution note, with an explicit eight-character requirement; Reopen remains in the top bar for resolved records. Shortened repetitive incomplete-check guidance and named the recheck section Next step. Response authorization, note validation, stored evidence and recheck endpoints are unchanged.

Validation: workspace-alerts-ui, alert-response-permissions-ui and alert-recheck-ui: 9/9 tests across 3 files passed. npm run build (TypeScript + Vite) passed with the existing chunk warning; git diff --check passed. Rebuilt signed-in page showed Acknowledge/Assign at the top and the resolution note/help in the scrollable detail. No response or scan submitted. This is a focused usability correction, not full design or operational acceptance. Unrelated dirty CSS and mockups preserved.

# Build and verification log

## 16 September 2026 — Scan and Alerts regression correction

Owner reported Scan/Alerts still broken visually after the composition batch. Direct browser comparison found old CSS leaking into new layout: Scan tabs inherited column direction/icon bottom margins/inset shadow and upload panel border; Alerts inherited the former toolbar padding and tab container border. Scoped overrides now explicitly reset these properties. GitHub Scan puts connection management below the form and scope guidance on the right, and removes duplicate repository heading. No scan submission logic changed.

Incomplete alerts now show one status, omit redundant technical location/check-status sections, and hide empty related-release blocks in both actual WorkspaceAlerts and legacy AlertsScreen mounts. Finding-specific locations/exposure and nonempty related evidence remain. Empty queues use one column instead of two empty panels. Read-only/resolve/assignment safeguards are unchanged.

Verification: 33/33 focused tests across7 files (workspace alerts, response permissions, related releases, recheck, Scan prerequisites and GitHub scan/scope). TypeScript/Vite build passed; existing chunk warning. Browser exercised In progress (3 rows), Resolved (0), and Package or build switching without mutating data. Computed Scan tabs now row/48px with outer panel border0; upload grid and aside fit1422px viewport. No full-suite repetition, deployment, server restart or account mutation.

## 16 September 2026 — approved journey composition correction

Owner rejected the preceding visual-completion claim. It established functioning components but did not faithfully reproduce `36-journey`, especially Overview/Releases. This batch replaces the old dashboard panels with the approved hero/totals/recent table/activity structure; replaces Releases with uploaded/connected/attempt collections; and gives results compact metadata and Findings/Files/History/Proof views. Finding explanations use two columns; manifests remain real retained evidence. History actions reveal the required tab before focus. Failed attempts no longer appear under completed uploads, and Overview attention links open the Attempts filter.

Coverage, Team, Tokens, Notifications, Workspaces, Audit and Install health now use reference table/row composition. Scan, Policy and Retention use the reference form/explanation split. Timeline groups actual events by local date. Artifact-only workspaces also receive the release collection and independent retention/audit composition. Registry credentials use an explicit Add action and table; underlying credential operations and deletion confirmations are unchanged.

Verification on this worktree (base a27d076, unrelated pre-existing index.css/mockup edits preserved): cumulative focused UI run **184/184 tests in 25 files**, 12.57s; includes release tabs, hidden-target navigation, policy lifecycle, scope isolation, mutation focus, workspace actions, scan prerequisites and independent-workspace transitions. Earlier cumulative run found two obsolete registry tests, corrected to open Add registry before Save token; targeted registry/timeline rerun passed6/6. `npm run build` passed (TypeScript and Vite, existing chunk-size warning); `npm run lint` exit0 with existing warnings; `git diff --check` passed. The prior full1,521-test suite was not repeated for this presentation batch. No scanner/backend/schema/production-policy modifications.

Signed-in in-app review inspected Overview and Releases against the live reference, plus saved upload6f7e4c8c… result/Files/History navigation, Team and Policy. Completed uploads showed three real rows; Files retained64 entries; Verify a fix selected History. Browser reported1422px document/viewport with no document overflow on Releases/Team/Policy. Screenshot viewport sizes changed while the owner browsed; these are composition review, not a pixel-diff certificate or all-state accessibility acceptance. Local captures are under output/design-qa/fidelity-2026-09-16. Reference-only data is not copied: Overview file totals are unavailable, activity is limited to returned checks, retention has actual supported values, and provider routing is not invented. Remaining Gate C manual/operational limits and GitHub billing block remain as previously documented. No deployment, Railway activation, or customer mutations were performed by this batch.

## 16 September 2026 — approved connected-journey production implementation

The approved `public/mockup-review/2b/36-journey` direction is implemented in the real signed-in Watch application. The shared shell now uses the 224px rail, 64px top bar, quiet charcoal stage, restrained seven-pixel surfaces, fine dividers, Inter stack and semantic review/warning/clear colours. Overview renders the approved release-decision hierarchy from real saved evidence; Alerts uses quiet queues and human-readable rows; Scan exposes evidence-type tabs and visible GitHub/result actions; Timeline presents retained activity with keyboard-complete filters; Notifications and Policy use task tabs with visible explanatory content. The existing evidence, permissions, workspace scoping and API behavior remain in place.

Release remediation now presents Original finding, Reviewed change and Rebuilt evidence as one visible three-step workflow. Technical activity remains secondary. Future-dated Timeline rows are excluded from the retained window, and tests prove the boundary. Notification and Timeline tabs expose tab/panel relationships and roving Arrow/Home/End behavior. The optional GitHub-install header action appears only at the 2xl breakpoint so normal desktop widths preserve the primary search, scan, guidance and account controls.

Independent four-role focused verification covered 20 files / 183 tests before integration. Final current-source verification:

- `npx vitest run` outside the restricted sandbox: **1,521 tests / 255 files passed**, 330.93s. The first restricted run passed 1,513 cases and failed seven loopback/CLI cases with `listen EPERM`, plus one obsolete notification-role assertion. The four affected integration files then passed **63/63** with loopback access, the semantic-tab assertion was corrected, and the final complete run passed.
- `npm run typecheck`: passed.
- `npm run lint`: exited 0 with the repository's existing warning set; this is not a warning-free claim.
- `npm run build`: passed; existing >500 kB chunk warning remains.
- `npm run build:api`: passed.
- `git diff --check`: passed.

After commit `556f4ae` was pushed, GitHub created push and pull-request runs for both CI workflows but executed no steps. Each check was annotated: `The job was not started because recent account payments have failed or your spending limit needs to be increased.` This is an external GitHub Actions account-state block, not a source-test failure. Correct the repository owner's Actions billing/spending limit and rerun the checks; do not represent the remote checks as passing until that happens.

The preserved signed-in Codex browser verified Overview, Alerts, Scan, Timeline, Notifications, Policy and saved upload `6f7e4c8c-0bd1-48e8-84c2-b5f10487dcd6`. The release detail visibly contains the three remediation steps. Desktop reported 1422×800 CSS pixels; a requested 390×844 responsive override reported the browser's 433×800 minimum viewport. Document width matched viewport in the inspected layouts, mobile alert selection opened the exact detail, and the final browser log contained no warnings or errors. Reference and implementation capture paths, inspected regions and limits are recorded in `/design-qa.md`.

No scan, alert response, remediation action, provider, billing, deployment, production safeguard or customer record was changed. The local server/database/GitHub connection remain live. Railway worker connection and deployment are a separate next step. Native 200% zoom and audible screen-reader execution remain external manual acceptance items, so this milestone does not declare all of Gate C or production readiness complete.

## 9 September 2026 — quiet loading and compact Alerts navigation

Shared Watch data loading now keeps only a screen-reader-only polite status and renders no visible skeleton cards, rows, borders or reserved placeholder height. The separate initial Watch-opening lighthouse is unchanged. Alerts removes the redundant visible **Status** label so Open, In progress and Resolved retain the full queue row; its named tablist, roving keyboard behavior, counts and ownership filter remain. Connected-release actions from Overview now open Connected revisions with their workspace and installation scope, and alert priority copy no longer calls operational response state verified exposure. The archived-workspace boundary uses a contextual **Open workspace settings** action without restoring the removed sidebar Manage link.

Independent verification: `npm test -- tests/watch-data-state.test.tsx tests/alert-filters-keyboard.test.tsx tests/alert-queue-keyboard.test.tsx tests/artifact-overview-ui.test.tsx tests/overview-next-action.test.ts tests/workspace-management-ui.test.tsx tests/workspace-entry.test.tsx` passed **49 tests / seven files** in 3.71s; `npm run typecheck` and `git diff --check` passed. Final `npm run build` passed with the existing >500 kB chunk warning. After reloading the preserved signed-in app, Alerts visibly showed the three queue tabs without the Status label; navigating to Notifications showed ready content with no skeleton placeholder. No data, response, scan, notification or provider mutation occurred. Actual screen-reader speech remains unverified.

## 9 September 2026 — Gate C cumulative UI milestone and final 1024px read

One cumulative current-source UI milestone passed **260 tests / 38 files, zero failures in 17.57s**. It includes shell/navigation/workspace UI; Overview/First Proof; Scan; Alerts; Coverage and the rendered Timeline chart; uploaded/hosted Releases; release intelligence/history/gate/gate access/remediation/parity/capture/agent/outcomes/explanations; and Notifications/Policy/Team/Tokens/Retention/Audit/Health/Registries. `npm run typecheck` and `npm run lint` passed; lint retains recorded warnings. The final frontend build for this source passed immediately before this cumulative run with the existing >500 kB chunk warning. No backend integration/full suite was repeated.

Exact cumulative command: `npm test -- tests/artifact-shell-navigation.test.tsx tests/watch-accessibility.test.tsx tests/watch-architecture.test.ts tests/workspace-entry.test.tsx tests/workspace-management-ui.test.tsx tests/artifact-overview-ui.test.tsx tests/first-proof-transition.test.tsx tests/scan-submission-navigation-ui.test.tsx tests/alert-queue-keyboard.test.tsx tests/alert-filters-keyboard.test.tsx tests/workspace-alerts-rendered.test.tsx tests/alert-response-permissions-ui.test.tsx tests/alert-off-page-detail.test.tsx tests/coverage-detail-ui.test.tsx tests/workspace-coverage-health-ui.test.tsx tests/watch-exposure-chart-ui.test.tsx tests/uploaded-releases-ui.test.tsx tests/uploaded-release-brief-ui.test.tsx tests/hosted-release-evidence-ui.test.tsx tests/release-workspace-scope-ui.test.tsx tests/release-intelligence-panel.test.tsx tests/release-assurance-history-mount.test.tsx tests/release-gate-controls.test.tsx tests/release-gate-access-controls.test.tsx tests/release-remediation-controls.test.tsx tests/production-parity-controls.test.tsx tests/automatic-capture-controls.test.tsx tests/agent-access-controls.test.tsx tests/release-outcomes-controls.test.tsx tests/release-explanation-controls.test.tsx tests/workspace-notifications-ui.test.tsx tests/workspace-scan-policy-ui.test.tsx tests/workspace-team-ui.test.tsx tests/workspace-tokens-ui.test.tsx tests/workspace-evidence-settings-ui.test.tsx tests/workspace-exceptions-ui.test.tsx tests/deletion-request-ui.test.tsx tests/settings-install-interactions-ui.test.tsx`.

The signed-in 1024×900 matrix was repeated only to close two earlier reads that captured pages before their heading loaded. Overview (`EmotiveImpact personal`), Scan (`What do you want to prove?`), Alerts, Coverage, Releases, real uploaded detail (`nospoilers-web-build.tgz`) and Timeline (`90-day timeline`) all loaded their h1 and measured exact 1024px document/client width. The browser returned to Overview and its viewport override was reset. No mutation occurred.

The in-app browser's capability inventory exposes visibility and viewport controls only; it has no native zoom or reduced-motion media emulator. The recorded 720×450 pass is 200%-equivalent CSS reflow for a 1440×900 display, not a native zoom claim. Actual screen-reader speech is also not claimed. These are evidence limits, not permission to use a separate unauthenticated browser or alter production state.

## 9 September 2026 — Gate C remediation focus and remaining settings interactions

Selecting another remediation case removes the old selector during its scoped read. The UI now records that keyboard origin and, after the requested case loads, focuses a new case heading; a failed read focuses its alert. Deliberate focus movement and record/stream scope changes cancel this continuation. Existing request scope, confirmation reset, signed evidence and mutation behavior remain unchanged.

Install Health and Private Registries now expose mutation failures as alerts and conditionally focus them only while the initiating control still owns focus. Health rows stack at narrow widths and long installation, permission and job details wrap. Registry origins wrap; non-administrators receive an explicit read-only explanation. The header shortcut is **Add registry**, accurately describing that it focuses the credential form, while the actual submission remains **Save token**. Permissions and APIs are unchanged.

Independent verification: `npm test -- tests/release-remediation-controls.test.tsx tests/settings-install-interactions-ui.test.tsx tests/artifact-shell-navigation.test.tsx tests/watch-accessibility.test.tsx tests/watch-architecture.test.ts` passed 33 tests / five files in 2.47s; `npm run typecheck` passed. Affected-file lint had zero errors, retaining one existing remediation effect warning and one test-double immutability warning. Final `npm run build` passed with the existing >500 kB chunk warning; `git diff --check` passed.

Signed-in real-app review at 390×844: Install Health loaded its actual recent work with rows computed as column layout and document width 390px. Private Registries loaded the real administrator form with **Add registry** and **Save token** separately; it also had no document overflow. The browser returned to Overview at its normal viewport. No permission test, registry credential, remediation, policy, scan or customer-data mutation occurred. Error-focus behavior remains rendered-test evidence because deliberately provoking a live external request would change or invoke connected state.

## 9 September 2026 — Gate C settings hierarchy, CI-access recovery and dense-layout evidence

Retention and audit no longer present all loaded settings inside a dashed empty-state container. They use the shared page heading and a solid padded settings card; only a truly empty audit page uses `watch-empty`. The audit table has fixed columns and long-identity wrapping. Data-deletion review uses a responsive labelled card with full-width select/confirmation fields, wrapping phrases, accessible checkbox spacing and a current-inventory section. Existing owner authority, review-only semantics, impact validation and typed confirmation remain. Policy-exception selection/detail gains padding, wrapping and minimum target sizing without changing approval rules.

`ReleaseGateAccessControls` is keyed to stream and record scope. Refresh, identity changes and failed grant/revoke writes remove stale grants, selected token and consent; reads use the shared labelled skeleton. Fresh revocation-only authority remains usable. When a failed initiating action disappears, focus moves to the error only if the user has not moved focus elsewhere. No server permission or gate behavior changed.

Independent combined verification: `npm test -- tests/workspace-evidence-settings-ui.test.tsx tests/deletion-request-ui.test.tsx tests/workspace-exceptions-ui.test.tsx tests/release-gate-access-controls.test.tsx tests/release-gate-controls.test.tsx tests/release-intelligence-panel.test.tsx tests/watch-accessibility.test.tsx` passed 54 tests / seven files in 4.15s; `npm run typecheck` passed. The tester found one new lint warning from a redundant read-effect clear; removing it preserved the keyed/explicit refresh behavior. Final `npm test -- tests/release-gate-access-controls.test.tsx` passed 10/10 and its affected-file lint passed without warnings. Final `npm run build` passed with the existing >500 kB chunk warning; `git diff --check` passed.

Signed-in browser evidence reused the existing server/database/GitHub connection. The real connected warning release at 390px exposed its Release Gate and connected-source CI-access disclosure with no document overflow; the fresh view correctly explained that enabling was unavailable while retaining the separate authority model. No grant or policy mutation occurred. Current normal-state matrix: Overview, Scan, Alerts, Coverage, Releases list, real uploaded detail and Timeline fit 390×844; the same core routes fit 768×900, 1024×900 and 1440×900, with correct loaded headings except two 1024 reads captured before loading completed. Notifications, Policy, Team and Retention fit 768; Policy fit 1024/1440. At 720×450, used as an effective CSS viewport for 200%-equivalent reflow from 1440×900, all core routes fit with loaded headings. This is not native zoom.

All real release-assurance disclosures—outcomes, capture, parity, gate, remediation, agent access, explanations and history—were expanded at 720px; controls remained within the document. The retained 64-file manifest table measured 616px inside a 660px container and long hashes used anywhere wrapping. With nine disclosures open at 390px, document width remained 390px; the manifest remained locally contained. Full-viewport visual checks of Overview at 390/1440 and release detail at 720 showed no clipping in the inspected viewport. These are layout and accessibility-tree observations, not a screen-reader or native-zoom claim. No scan, evidence, provider or customer-data mutation occurred.

## 9 September 2026 — Gate C shared headings and connected evidence detail

The workspace notification, scan-token and independent-policy pages now use the shared `WatchPageHeader` contract for their identical settings kicker/title/lede structure. Their existing header landmarks, copy and controls remain. Connected release findings now share the uploaded-evidence detail panel's padding, long-text wrapping, focus treatment and reduced-motion scope. Its two-content finding rows use two columns on wide screens and one on narrow screens. The selected finding is a named polite live region; this supplies assistive markup but does not prove a particular screen reader announced it.

Independent review found no concrete regression. `npm test -- tests/workspace-notifications-ui.test.tsx tests/workspace-tokens-ui.test.tsx tests/workspace-scan-policy-ui.test.tsx tests/hosted-release-evidence-ui.test.tsx tests/uploaded-release-brief-ui.test.tsx tests/release-workspace-scope-ui.test.tsx tests/watch-accessibility.test.tsx` passed 38 tests / seven files in 4.08s. `npm run typecheck` and affected-file `oxlint` passed; lint retained one pre-existing effect-state warning in `HostedReleaseEvidence.tsx`. Final `npm run build` passed with the existing >500 kB chunk warning.

The signed-in real warning release rendered the named polite selected-finding panel at 1167px with two-column rows and no document overflow. At 390×844 the panel retained its real long path, the row collapsed to one column and document width remained 390px. The browser returned to Overview at its normal viewport. No settings, finding, exception, scan, server or customer-data mutation occurred.

## 9 September 2026 — Gate C mockup packaging and shared visual tokens

The approved source mockups remain available for local visual comparison, but Vite production builds now remove both complete generated galleries (`mockup-review` and legacy `mockups`). The production Mockups page omits its review-gallery link; Watch and Scan navigation remains. The live homepage continues to use its separate assets. This is a build boundary only and does not change authentication, customer evidence, scanning or provider behavior.

Overview and release-intelligence CSS now use the shared panel, line, text, action, danger and warning tokens. Alerts and Timeline share the warning token. Independent testing caught a low-contrast open-warning label introduced during consolidation; dark foreground text corrected it to a calculated 5.60:1 on the panel and 5.69:1 on the chart lane.

Focused implementation checks: `npm test -- tests/prototype-packaging.test.tsx tests/watch-architecture.test.ts` passed 15 tests / two files; `npm test -- tests/watch-exposure-chart-ui.test.tsx` passed 3/3 before and after the contrast correction. Independent cumulative UI review passed 98 tests / 12 files in 5.87s and `npm run typecheck` passed. Final `npm run build`, affected-file `oxlint`, direct output inspection and `git diff --check` pass. The existing >500 kB chunk warning remains. Output inspection confirms both gallery directories and the compiled `/mockup-review/` link are absent, while source galleries remain. The signed-in Timeline rendered 24 real warning rows with the shared token, dark foreground and no 1440px document overflow; this was a presentation read only. No full suite, real scan, server restart or customer-data mutation was performed.

## 9 September 2026 — Scan/Coverage/Alerts and advanced-tool interaction states

Working-tree batch after `0fe371e`: Scan exposes permission-read failure/retry across non-receipt modes and shows a labelled GitHub loading state instead of premature sign-in. Coverage detail bounds long identities/digests and keeps its close target usable. Alerts confines queue shortcuts to the alert workspace, protects editable/modal interactions, announces selection and displays a J/K hint; long titles and bodies wrap. Existing routes, response actions and evidence semantics are preserved.

Production parity uses a shared labelled skeleton and conditional mutation-error focus recovery. Outcome and explanation controls recover focus after initiating controls disappear, including relevant failure/completion messages, without overriding deliberate focus moves. Existing stale-view clearing, prerequisites, consent, cancellation and provider boundaries remain intact.

Focused commands on the final runtime batch:

- `npm test -- tests/scan-submission-navigation-ui.test.tsx tests/coverage-detail-ui.test.tsx tests/alert-queue-keyboard.test.tsx tests/alert-filters-keyboard.test.tsx tests/watch-accessibility.test.tsx tests/workspace-alerts-rendered.test.tsx` — **30 tests / six files passed**, **3.26s**.
- `npm test -- tests/production-parity-controls.test.tsx tests/release-outcomes-controls.test.tsx tests/release-explanation-controls.test.tsx` — **27 tests / three files passed**, **2.24s**.

Final `npm run build` passed with the existing large-chunk warning. These are focused rendered checks and a build, not a full-suite rerun or live-provider verification.

Real signed-in Codex in-app **desktop** review: GitHub Scan rendered the connected repository picker with the actual 88 repositories and no premature/false sign-in state. Alerts rendered 24 actual alerts, the J/K hint, selected announcement and existing response/detail. Normal saved-release detail rendering was also checked earlier in this session. These observations do **not** establish CUA keyboard execution, error injection, mobile or 200% zoom verification. Those checks and broader assistive-technology/visual acceptance remain open; Gate C is partial. No new scan, backend mutation, production deployment or provider activation is claimed. Publication remains the orchestrator's separate report.

## 9 September 2026 — Overview states and release responsive accessibility

Working-tree batch after `f577fe8`: `ArtifactOverview.tsx` now labels initial loading, presents unavailable reads with readable recovery controls and gives archived workspaces a settings link. `WatchFirstProofOverview.tsx` keeps one primary existing-source action and wraps narrow controls. Existing fetches, status decisions and workspace isolation are unchanged.

`release-responsive.css`, imported by `ReleasesScreen.tsx` and `UploadedReleaseBrief.tsx`, adds scoped long-name wrapping, narrow list/preview/finding reflow and reduced-motion styles. Upload finding tabs now identify their active labelled panel. This is source implementation of responsive behavior; no actual mobile or 200% zoom acceptance is inferred from CSS.

Final focused command: `npm test -- tests/artifact-overview-ui.test.tsx tests/first-proof-transition.test.tsx tests/uploaded-releases-ui.test.tsx tests/release-workspace-scope-ui.test.tsx tests/uploaded-release-brief-ui.test.tsx` passed **55 tests / five files**, **3.36s**. Tests include delayed initial loading, honest empty transition, HTTP403/503 recovery, late prior-workspace responses and finding-tab panel association, alongside existing scope/navigation cases. Final `npm run build` passed with the existing large-chunk warning. No full-suite rerun is claimed.

Signed-in Codex in-app desktop review of the actual saved upload showed finding tabs, the labelled active panel and the real release tools/evidence. Actual mobile and 200% zoom were **not verified** for this batch. Outstanding viewport/zoom, broader representative states and assistive-technology/visual acceptance remain open; Gate C is partial. No backend/data change, scan, deployment or provider activation was required. Publication is reported separately by the orchestrator.

## 9 September 2026 — Overview priorities and consolidated release browsing

The actual workspace Overview now puts Next action, saved-scan totals and recent attempts before connected coverage and response activity. Live data uses compact solid cards, with a responsive secondary grid and connection-specific links inside Individual connections. First Proof activation precedes supplemental health. The redundant page-level New scan was removed, leaving the global action. Alert response no longer labels operational missing-release alerts as confirmed exposure. Counts, controller behavior and evidence routes remain server-grounded.

Releases now presents one visible browser selected through Saved attempts/Connected revisions tabs, including roving keyboard focus and labelled panels. The selected browser is URL-backed; record selection/deep links retain their evidence scope, while explicit switches clear conflicting selection state. Connected revisions use readable filenames. Upload attempts and connected revisions remain distinct persisted records; no data was deleted or deduplicated.

Verification: `npm test -- tests/uploaded-releases-ui.test.tsx tests/release-workspace-scope-ui.test.tsx tests/artifact-overview-ui.test.tsx tests/first-proof-transition.test.tsx` passed **42 tests / four files**, 2.58s. The final Overview-only adjustment then passed `npm test -- tests/artifact-overview-ui.test.tsx`: **18 tests / one file**, 1.43s. Final `npm run build` passed, including TypeScript, with the existing large-chunk warning. These are focused checks plus a final build, not a repeated full-suite run or full Gate C acceptance.

Real signed-in Codex in-app browser, desktop viewport **1168×909**: Overview showed one global New scan, Next action first, three totals, four real recent attempts, then Connected monitoring and Alert response solid secondary panels. Individual connections contains the per-connection links. Releases showed one tablist; Saved attempts initially displayed four actual attempts and its preview. Selecting Connected revisions added `releaseView=connected` to the URL and displayed only the ledger with three actual revisions, readable filenames, selected preview and export. No mobile CUA evidence is claimed for this batch. The preserved local server/database/GitHub connection remained in use; no scan, provider, notification or production change was required.

Remaining Gate C work includes outstanding viewport/zoom combinations, representative loading/error/permission states and broader assistive-technology/visual acceptance. This supersedes the earlier release-list investigation-only checkpoint below. Publication is recorded separately by the orchestrator; this entry does not claim a pushed commit.

## 9 September 2026 — sidebar workspace menu chrome

Removed the redundant **Manage workspaces** sidebar control, removed the heavy menu-container outline, and changed the create row to a plain menu item while retaining a restrained keyboard focus outline on the trigger. Focused workspace UI coverage remains 8/8; selection, creation navigation and permissions are unchanged.

## 9 September 2026 — duplicate workspace creation affordance removed

The workspace management page now keeps its existing **Create a workspace** form without the redundant plus tile. The sidebar workspace menu remains the single compact entry point for opening that form. Focused workspace UI coverage passes 8/8; no workspace, billing or authorization behavior changed.

## 9 September 2026 — sidebar workspace selector

The signed-in sidebar workspace control now presents avatar/initials rows and a **Create new workspace** plus item routed to the existing management form. The duplicate single-install identity card was removed; multi-source GitHub selection remains. Avatar URLs are accepted when supplied and fall back to initials on missing or failed images. The focused workspace-management and selector regression file passed 8/8. No workspace, billing, connection or authorization semantics changed.

## 9 September 2026 — outcome export month consistency

The private outcome summary month selector is now disabled while an export request is in flight. This prevents a deferred response for the previous month from replacing the summary beneath a newly selected month. The selector re-enables after the current export completes. The focused regression `npm test -- tests/release-outcomes-controls.test.tsx` passed 4/4; no server, provider, notification or production behavior changed.

## 9 September 2026 — owner-reviewed remediation and fresh real rebuild

In the signed-in local app, the owner review was recorded for remediation case `d44de9f3…`. Fresh corrected upload `6f7e4c8c-0bd1-48e8-84c2-b5f10487dcd6` completed at 11:20:15 UTC with SHA-256 `df8c0e6e07a57371bfd1e33f416b8825516f8b984d4aa0668949c494d66da902`, 64 files and zero findings. It was recorded in the `NoSpoilers web build` stream and selected under **Check a rebuilt artifact**. The saved remediation observation is `verified_absent`: the original finding was not observed in the rebuilt artifact under the same scanner and policy. This does not rewrite the original receipt/alert or verify production; review/build provenance is human-declared, not provider-attested.

## 9 September 2026 — real upload payer correction and customer fixture removal

Continued from 21a4a87 without repeating its completed regression. Real signed-in Codex browser uploaded the actual compiled NoSpoilers dist archive, not a fixture. SHA-256 `8a3bddcc23935cf4cf69cc005feb08dd240e2077d01001cfd52dac93ec53cf71`; attempt `f0c6acb1-04e6-40b7-b5d5-3c1e95f9fc50` failed before parsing and retained no report or receipt. A temporary copy of the local database showed refunded usage, an active recorded personal payer and an inactive source-installation payer; the live database was not opened by the diagnostic. The artifact separately passed isolatedScan (68 files) under both shell and exact server Node executables. This is parser evidence, not a completed hosted scan.

Fixed upload-worker billing lookup: workspace attempts honor their immutable admission payer instead of falling back from a null installation payer to the connected GitHub installation. Pre-workspace legacy behavior remains. Independent real-store/worker/parser/HMAC regression covers success under personal coverage, denial after personal expiry despite active installation coverage, correct usage/refund and unchanged earlier receipt. Ownership file 3/3 passed; adjacent upload-workflow 6/6 passed.

Removed the remaining customer-facing Local review examples catalogue and fixture-submit path from ScanPage. Internal fixture API/tests remain isolated test infrastructure. Migrated navigation tests to file-input/upload transport interactions: 17/17 passed. Actual signed-in rebuilt screen confirms upload remains and fixture controls are absent. Added definitive pre-enqueue HTTP409 retry recovery to the pending picker correction: 11/11 component tests passed across two files. Inspected unfinished gate billing test passed unchanged (1/1, 2.96s); pending history keyboard file already passed13/13 at the checkpoint and was not repeated in isolation.

Batch frontend build/typecheck, API build, lint and diff checks pass (existing warnings). Cumulative regression completed: 1,377 passed / six failed, 236 passed / one failed file, 1,383 total cases /237 files,255.97s. All six failures are obsolete fixture-library source assertions in fixtures.test.ts; test-only correction and affected-file recheck follow. Owner explicitly approved restart with existing state; the same configuration/database/signing material and GitHub connection were retained. Restarted source-server session42604 is live at4347. Retry created successful attempt408e7b98-0035-45b5-be7c-865d13e787d7 at09:23:33 UTC with the same digest,68files/3warnings. Actual release brief confirms server-verified receipt signature/binding and REVIEW for non-blocking findings. Explicit stream creation saved this first record in NoSpoilers web build, with no baseline automatically adopted. Warnings identify internal prototype Markdown accidentally copied into dist; packaging correction follows. The failed attempt remains honest history; no synthetic evidence, production change, provider activation or notification was introduced.

### Final batch evidence

Cumulative source was frozen through the payer/UI fixes: `npm test` (Node22.12.0, permitted local sockets) completed1,377passed/6failed,237files,255.97s. The six failures were old source assertions requiring the removed customer fixture library. Replaced those with one absence assertion while preserving every scanner-format and CLI assertion; `npm test -- tests/fixtures.test.ts` then passed25/25 in1.31s. Final inventory is1,378cases, not a newly executed all-green full run. No full-suite repetition followed this test-only correction.

The real scan exposed build packaging of internal prototype Markdown. `vite.config.ts` now removes only Markdown beneath the build output's mockup-review directory; all four original notes, prototype HTML/CSS/images and approved homepage remain. This build-only addition followed the cumulative run. `npm run build` passed after it; actual output inspection confirms zero packaged review notes and preserved homepage/prototype entrypoints. No scanner policy or finding suppression changed.

Actual rebuilt archive `nospoilers-web-build.tgz`, SHA-256 `df8c0e6e07a57371bfd1e33f416b8825516f8b984d4aa0668949c494d66da902`, was uploaded through the same real signed-in app. Attempt `0912f710-7150-4b67-8579-8e92590c1905`, checked09:27:19 UTC, saved64files/zero findings and displays Passes recorded checks with production explicitly unverified. Added it explicitly to the same NoSpoilers web build history; original three-warning record remains. This proves local real scan → signed saved evidence → build correction → new saved evidence and history. It does not assert a human-reviewed remediation declaration, provider-attested build linkage, deployed production parity or GitHub latest-release download. No source/capture/gate/reference/provider or public sharing was enabled.

## 9 September 2026 — submission rejection recovery after 21a4a87

Main picker/source-alert batch published as 21a4a87 to the existing feature branch; PR #44 remains draft. Follow-up fixes a retry lock after definitive pre-enqueue rejection. Explicit guarded 4xx error responses allow retry; network/5xx/malformed outcomes retain duplicate protection. Independent worker trace confirms stored job kind remains scan_latest_release, so terminal polling is valid. Ten focused component tests pass across two files, including rejected/uncertain submission and scoped recovery navigation. No real scan submitted or production setting changed. This follow-up is separate from the earlier cumulative run.

Follow-up frontend build/TypeScript passed. Reference adopt/revoke/private-export failure recovery needed no runtime correction: three added keyboard regressions prove Enter dispatch, removal of stale actions, focus on error, Tab to retry and Enter recovery. The panel file passes all 13 cases. These are rendered component tests, not a screen-reader certification. Historical acceptance paragraphs are explicitly labelled to avoid rebuilding completed subsystems.

## 9 September 2026 — connected repository picker and incomplete-check presentation

New Scan now provides an in-app searchable repository picker, exact queued-job progress, bounded polling, identity cancellation, explicit terminal retry and duplicate protection while outcome is unknown. Missing-release alerts now say “Check incomplete” and “No scanned release”, not exposure duration; actual exposure presentation is preserved. Builder/independent component tests: seven cases across two files passed. Final frontend build (including TypeScript), lint and diff validation passed; existing warnings remain.

Real signed-in Codex browser after rebuilding verified GitHub default, searching/selecting Emotiveideas, enabled scan action and scoped alert/setup links. Reloaded alert 23 verified the incomplete-check wording and removal of irrelevant rotation checklist. No new scan or alert mutation was performed. Full suite: 1,367 passed / seven failed, 236 files, 277.17s; sandbox denied CLI IPC and loopback sockets. Permission-corrected rerun of all four affected files (`fixtures`, `policy`, `receipts`, `setup-pr`) passed all 68 cases in 16.23s with no source changes or weakened checks. This is a full restricted run plus focused permission-corrected verification, not a single unrestricted full pass. Final API build passed. See NEXT-SESSION-HANDOFF.md for continuation state. Changes are still local.

## 9 September 2026 — real local GitHub and Codex browser verification

Supersedes the earlier local-configuration deferral below: the owner authorized and completed the separate local GitHub App setup, sign-in and installation. The application at port 4347 now shows the real EmotiveImpact personal workspace, 88 repository surfaces and 24 alerts. The signed-in Codex in-app browser is accessible through computer use; the separate Playwright browser has different authentication and is not required for this review.

Read-only live navigation verified alert selection changes the selected repository and preserves workspace/installation. The current alert list contains missing-release warnings; the Releases page has no saved revisions or uploaded attempts, so real release-preview switching remains unverified. Coverage's “Open related alerts” reproduced a defect: the source query was retained but the inbox displayed all 24 alerts. Corrected repository/website source filtering before server pagination and counts, explicit recovery for unsupported filters, export scope and exclusion of unrelated selected-alert URLs. After rebuilding and restarting with the same local database and signing configuration, the signed-in Codex browser showed Open 1 and only Emotiveideas; opening alert 3 and reloading retained that source and alert; “Show all workspace alerts” restored all 24. New scan also opened GitHub in the app with workspace/installation retained. No alert status, policy, repository or retained history was changed during these checks.

Frontend build and final typecheck passed; diff validation passed. Focused database/API and rendered checks passed (the rendered file has 3 passing tests, including source-query forwarding, unrelated-detail exclusion and filter clearing). Existing bundle-size and React lint warnings remain. This is local integration evidence, not a new full-suite run or production deployment. Changes remain local and uncommitted.

## Owner decision — individual collaboration and first real test

Owner selected option A: explicit individual invitations into isolated client workspaces using existing roles. Agency-organization delegation and CSV invitations are deferred. Existing named GitHub-account invitations were verified with workspace-membership/workspace-team-ui18tests and real workspace-api1test (19total/3files); no replacement permission system needed. This does not claim multi-provider/email-only signup.

Read-only first-real-test check: local OAuth/secrets are not configured in the inspected environment; no4347server listening. Default local database directory exists but was not opened/migrated, so readiness is unverified. Loopback nonproduction scanning permits bounded subprocess execution; production/nonloopback scanning still requires the current Docker isolation executor. Railway hosting alone does not fulfill parser isolation. Owner forbids Docker and previously deferred GitHub to production: do not bypass the guard, restore fake review or silently deploy. A real local test requires revisiting that GitHub deferral; production requires a verified non-Docker isolation solution plus real configuration/deployment authority.

## 9 September 2026 — remaining temporal and workspace checks

Added two temporal assertions to existing automatic-capture-integration.test.ts: real parity API returns stale after completed_at+24h+1ms without changing stored result; a run queued under valid ownership stops after ownership expires before worker execution, with zero DNS/HTTP attempts and null result. Existing completed evidence remains unchanged. Affected PGlite integration file **2 tests passed**,4.76seconds; no runtime changes. This follows the1,365-test frozen runtime regression, not a new full run or native PostgreSQL claim.

Actual isolated browser workspace switch held an old real history response, changed workspace through the selector, then released the old response. After the lighthouse disappeared and the destination first-proof page settled, URL/selected workspace remained correct with zero old stream/history/export controls and zero page errors. `output/playwright/history-workspace-late-response-safe.png` was visually inspected after settling. Browser and fixture stopped; port4380 closed. No customer data, credentials or provider used.

## 9 September 2026 — history comparison and conflict browser evidence

Actual built React application on internal fixture4380: older/newer saved records showed exact record identities, different-history/current-release notices and prior-history counts0/1. A browser-injected503 (explicit fault injection, not provider failure) hid export/actions and focused the alert; retry fetched the real API successfully. A real concurrent baseline update advanced revision0→1; stale UI exclusion received409, and retry showed revision1 with record not excluded and reference still available. Original clean receipt was unchanged. No page errors. Local `output/playwright/history-conflict-desktop.png` shows conflict/retry; scripts/screenshots remain untracked QA artifacts. Browser contexts and fixture stopped; port4380 confirmed closed.

A delayed snapshot GET reproduced an integration defect: the prior snapshot's agent-grant button remained enabled during history selection. No credential was created. Fixed by unmounting scoped release tools behind a skeleton during parent refresh, cancelling child lifetimes and removing old actions. Release Gate remains bound to the page's release, not a historical selection. Focused panel suite10/10 passes, including two new deferred selection/refresh cases. Frontend/typecheck/API builds and lint pass with existing warnings; final cumulative run10278 passed **1,365 tests / 234 files**,290.26seconds, on frozen source.

Rebuilt browser verification confirms zero old agent buttons during delayed history selection and the correct older selection after completion. Upload hard reload restores the page's uploaded-record scope; direct hosted release navigation/reload restores its correct stream and release scope. No page errors or overlays. At390px with reduced motion enabled, Enter opens the approved-reference disclosure and Tab reaches the reason field with visible solid outline; no document overflow. `output/playwright/history-reduced-motion-keyboard-mobile.png` visually confirms that narrow journey. Isolated browsers and fixture stopped; port4380 confirmed closed. Pending-workspace and broader assistive-technology behavior are not inferred from these checks.

## 9 September 2026 — automatic capture state recovery

AutomaticCaptureControls now scopes pending reads/mutations and draft consent to the selected stream/record, cancels requests on scope changes, hides stale controls after mutation failure and shows Checking/Unavailable rather than a false Off. Ordinary reads use WatchSkeleton. Failed saves restore focus only when the user remains on the initiating control; disabling an existing rule retains its separate authorization behavior. Independent focused rendered tests: **10 tests / 2 files passed**, including forced late responses after scope changes and preserved outside focus. Frontend/typecheck and API builds pass; lint passes with existing warnings. Final cumulative run72052 passed **1,363 tests / 234 files**,294.81seconds, against frozen source. Browser evidence and its scope follow below.

Integrated browser follow-up on isolated internal fixture4380: actual clean-upload UI stream creation, reference adoption/revocation (revision2), exclusion and restoration passed; zero console errors and no390px document overflow. Desktop screenshot `output/playwright/upload-reference-revoked-desktop.png` was visually inspected and shows revoked reference/revision2. Mobile screenshot only establishes layout; restoration was established by DOM assertions, not that image. Shared browser profile was unavailable, so an isolated installed Playwright context was used without changing the user's tabs. Fixture/browser and owned CLI daemon were stopped; no customer data or provider used.

Finite remaining integrated-browser evidence from section2: older/newer comparison scope; error/conflict/retry; pending workspace changes and deep-link/reload across both detail paths; keyboard/focus and reduced-motion journeys. Prior logs and this increment establish both detail renders, stream creation, explicit capture, hosted/upload reference adoption/revocation, exclusion/restoration and private export. These are verification gaps, not declarations that those features are unbuilt. A suspected remediation pagination defect was withdrawn after verifying the matching100-case creation limit; expanding that capacity is not an established requirement.

## 9 September 2026 — optional aggregate explanation contracts

Four-agent implementation adds `release-explanations.ts`, `ra_010_release_explanations`, actual session-scoped GET/POST routes and the selected-history explanation panel. No production provider is supplied or auto-enabled. Exact aggregate disclosure, held/readiness distinction, fixed adapter instructions, provider/config-bound consent, UUID idempotency, workspace-wide UTC-day call/reserved-cost limits, cancellation, 20-second timeout, sanitized errors and separate human review are connected. Drafts never change receipts, gates, references, alerts or remediation. Schema keeps immutable model/cost/consent audit and composite snapshot/stream identity; original deletion cascades drafts without refunding workspace budget. See EXPLANATIONS.md.

Independent tester exercised injected-service negative authorization/data/budget/cancellation cases. Root actual Hono/session/HMAC/signed-upload test covers disabled default, foreign/viewer/CSRF denial, configured test-adapter request/replay/review and unchanged original receipt. Disposable native PostgreSQL migration replay and this real API journey passed alongside UI/security checks:8tests/3files,3.93seconds. The test database was stopped (verified no running server) and its disposable directory removed; no Docker/customer data was used. Native checks preceded only final multiline-review validation.

Final focused domain/security/API/component/history checks:25tests/5files passed,5.50seconds. Includes multiline review validation preserving line breaks while rejecting unsupported controls. Final frontend/typecheck and API builds pass; full lint passed with existing warnings and final changed-file lint is clean. Cumulative run32551 finished1350passed/6failed: it cached the old service before the multiline validator export while loading the new tests afterward (`reviewedExplanationText is not a function`). No assertion was weakened. Final cumulative run28186 passed **1,356 tests / 233 files**,292.11seconds, against frozen source with local socket permissions. No live provider, new browser screenshot or deployed integration proof is claimed. A concrete provider adapter with demonstrated billing/output guarantees remains separate approval/implementation work, not an invisible enabled feature. Production GitHub verification remains deferred by owner request.

## 9 September 2026 — release-tool keyboard recovery and website eligibility

Four-agent batch: builder improved history record accessible names, selection announcements and failed-action focus recovery; fixer added server-derived production website eligibility with disabled choices/recovery text; independent tester reproduced focus loss in Gate/Remediation/Agent controls before root corrected mutation error recovery. Focus remains with another control if the user moved away, and initial read failures do not steal focus. Agent/remediation loading uses existing WatchSkeleton. No enforcement, receipt, source activation or pricing semantics changed.

Focused combined component/database run: 22 tests / 4 files passed, 2.14 seconds. Earlier adjacent cleanup/gate/remediation/agent run: 16 tests / 4 files passed. Independent final focus checks: 7 passed (including focus moved outside during a pending mutation). The build initially identified missing explicit extensions in the new parity test imports; corrected without runtime changes and the parity database test passed again. Frontend build/typecheck, API build and lint then passed; existing chunk-size and lint warnings remain. Final test-only addition also passed typecheck.

Cumulative run30980 finished: 1,332 passed / 7 failed across229 files,283.81seconds, with two unhandled local-listener EPERM errors. Failures were confined to receipt/policy/scanner CLI startup and setup Action loopback tests. Direct reproduction showed tsx IPC socket creation denied before application execution. With local socket permission enabled and no application/test assertion changes: receipt CLI subset4 passed (15 unrelated skipped), setup+policy19 passed, scanner fixtures30 passed. These rechecks cover all7 failures and both listener errors. This is a completed full-suite attempt plus successful affected rechecks, NOT a single green full-suite run. Future cumulative checks should use the permitted local socket context initially. No new browser/production-provider verification is claimed and no dev-review server was relaunched.

## 9 September 2026 — retire customer-facing synthetic review

Owner rejected fake review as a substitute for using the application. Removed the dev:review npm command, friendly synthetic sign-in/banner/automatic stream seeding and dedicated review helper. Retained the earlier internal QA fixture and regression infrastructure; no customer database or evidence deleted. All identified local servers were stopped before this change. Real GitHub configuration and provider verification are deferred by owner request, not completed. Historical launcher entries below are superseded.

Scope clarification: original Gate B B0–B8 is accepted in GATE-B-FINAL-EVIDENCE-MATRIX.md. The newer release-assurance branch extends that implementation; it does not reopen Gate B. Gate C design/accessibility/separation remains partial, Gate D operational evidence remains open, and Gate E enterprise identity/offer is a separate later scope. Latest release-assurance acceptance controls the additional capabilities, not old chronological 'unbuilt' notes.

## 9 September 2026 — isolated GitHub-free dev review

Added `npm run dev:review`, explicit `--dev-review` fixture mode and `scripts/dev-review-isolation.ts`. Builds the app, starts loopback localhost4372, signs into a disposable seeded owner workspace and creates hosted/upload streams through real authenticated routes. Visible banner and release links identify synthetic data. No gates, baselines, source rules or agent grants automatically activated. In-memory state resets on restart; no customer4347 data changed.

Independent tester identified localhost cookie collision, inherited provider credentials and browser-followed OAuth redirects before launch. Fixed with dedicated `ns_dev_review_session` translation (normal session cookie ignored), blank GitHub/Stripe/Resend/admin/cron settings, explicit provider-entry denial and off-origin Location rejection. Production mode rejects before database/server startup. No worker or outbound provider calls. Production start/build commands do not import this launcher.

Final launcher focused tests **6 passed**; build/typecheck passed after correcting one test import extension which initially stopped startup. Actual browser entry opened seeded GitHub release and all stream tools, clear banner, no overlay or console errors. Screenshot `output/playwright/dev-review-github.png`. Live HTTP checks confirmed dedicated cookie name and real GitHub auth returned409 with no external redirect. Prior cumulative core suite1326/226 is separate from this later launcher test scope. No production migration or paid activation.

Review workspace this run: `78ff2fce-e366-4c5a-a63c-351de2c0779c`, name `QA mixed workspace — disposable`. Stable entry is `/__dev-review`; IDs change on restart. Source/rebuild/production eligibility rules still apply; this does not fetch arbitrary real GitHub repositories. Saved four-agent continuation prompt accompanies this increment. No whole-platform completion claim.

## 9 September 2026 — coordinated visibility and stale-state fixes (after 92dd29f)

Three explicit subagents handled builder, investigator/fixer and independent tester roles; root integrated. Assurance errors no longer hide independently authorized history; HTTP202 remains honestly pending, including an empty body. Parity/remediation failed mutations clear old evidence/actions, scope changes reset drafts and requests, and missing prerequisites are explained. Agent access clears privileged controls and one-time credentials after denied reads/writes and manual refresh. No authorization bypass or backend enforcement change.

Builder mount-contract tests: **7 passed**. Fixer parity/remediation focused tests: **11 passed**. Tester credential/stale-state tests: **2 passed** after fix; no pre-fix failing run is claimed. Cumulative full regression: **1,326 tests / 226 files passed**, 276.87 seconds. Frontend/typecheck/API builds and lint passed; lint includes state-in-effect warnings in the newly hardened controls, alongside prior warnings, and the existing bundle-size warning. These warnings are not a clean-lint claim. No dependencies/schema or fresh native database run for this UI-only batch.

Root browser reloaded the built synthetic4371 release: stream controls remain available, parity explains the missing approved reference instead of silently disappearing. Independent tester browser was blocked by shared-profile ownership and was not represented as browser success; root retains browser verification ownership. Earlier middle-table assertions that gate/connected CI were unbuilt have been reconciled. Wider operational/accessibility acceptance and provider-backed/attested work remain open.

The later dev-review launcher is a separate increment; this full run does not cover its subsequently added tests or launcher changes.

## 9 September 2026 — history discovery, recovery and export scope (after 506a235)

Final full regression for this increment: **1,311 tests / 224 files passed**, 279.59 seconds. This run precedes the separately delegated assurance/parity/remediation/agent-state fixes; their verification must be recorded separately. No blocked or restarted test process was substituted for this result.

Implemented identity-keyed ReleaseIntelligencePanel, list workspace/link validation, stale control removal on list/mutation/export errors, skeleton reads and explicit private export scope validation. Service export adds workspace/stream scope without raw paths/people or changing unsigned status. Added a capability explanation and setup CTA that opens/focuses the existing form. No automatic grouping, policy adoption, agent grant or source activation.

Focused **28 tests / 3 files passed**, 17.18 seconds: five new panel tests (isolated child controls), existing persistence tests including the new scope assertion, and actual Hono/session/HMAC integration. Tests cover failed-list recovery, pending workspace switch, foreign list/export, setup focus and no mutation on opening. Typecheck/frontend/API builds and lint passed with existing warnings; no dependencies or schema change. No fresh native PostgreSQL run for this additive export/UI increment; existing PGlite integration ran against current source.

Browser verification used the existing supported Playwright fallback because agent-browser is unavailable. Fresh synthetic fixture4371 loaded meaningful app content with no overlay/errors. Actual user page4347 confirmed the missing-stream state and the new setup button/focus with no record mutation. In isolated4371, setup form created a real stream, revealed all connected controls and downloaded scoped private history JSON. No 390px overflow or console errors. `output/playwright/history-setup-mobile.png` visually inspected; synthetic evidence, not customer activation or full accessibility acceptance. Full-suite result recorded below after completion.

## 9 September 2026 — gate stale-state and authorization acceptance (after 37a89f6)

Fixed real UI gaps in ReleaseGateControls: expired/superseded decisions previously retained override forms that the server would reject; failed writes left old actions visible. Decisions now say recorded readiness and explicit inactive reason; a deadline timer removes expired overrides while the page stays open. Failed writes clear stale view/confirmation, refresh uses WatchSkeleton, and a keyed child invalidates old bindings/requests immediately on identity changes. Existing black/off-white/red styling, original receipts and enforcement rules remain unchanged. React checklist informed request cleanup and identity-local state.

Added six component cases (8 total) covering inactive decisions, live expiry, conflicting-write refresh and pending record switch. Expanded actual Hono/session/token/HMAC test proves wrong digest, wrong deployment, viewer/foreign access and revoked token cannot consume an outstanding decision, with no consumption row created. Existing policy/consume concurrency tests remain.

Focused PGlite/component: **9 tests / 2 files passed**, 2.80 seconds. Disposable native PostgreSQL/component: **9 tests / 2 files passed**, 2.98 seconds; migration replay and gate lifecycle included. Verified loopback synthetic database identity before reset; no customer data or Docker. Native server stopped and confirmed stopped.

Full `npm test`: **1,306 tests / 223 files passed**, 272.69 seconds. Typecheck (frontend build), frontend/API builds, lint and diff checks passed with existing warnings. Full run began before a final inactive-state wording correction; the final wording is covered by the later 9-test native/component run, rebuilt frontend and browser. No fresh npm ci or dependency change. API implementation unchanged.

Actual built-app synthetic fixture 4370: adopted policy, evaluated failing record, then superseded policy through real routes. New UI labels policy changed and has no override form. Gate and decision disclosures opened with keyboard Enter after focusing; 390px layout has no horizontal overflow, zero console errors. Screenshot `output/playwright/gate-inactive-mobile.png` visually inspected; this is a narrow keyboard/mobile check, not full tab-order/screen-reader or both-mount acceptance. Broader cross-flow role/error/race/load acceptance and optional provider contracts remain next. No merge/deploy/production migration or customer activation.

## 9 September 2026 — private monthly outcomes (after 55c7982)

Implemented outcome types/window validation, migration/service, Hono routing/rate budget and shared release-detail controls. Explicit opt-in, revisioned preferences, immediate opt-out, source-scoped signed record counts, unique-byte/repeat separation, current remediation/reference revalidation, minimal derived events and refreshed private unsigned download. No dependency changes, provider activation, emails, telemetry archive, production migration or deployment.

Node 24.19.0 with existing locked dependencies: final `npm test` **1,300 tests / 223 files passed**, 263.21 seconds. Focused outcome/window/UI/real-composition checks **11 tests / 3 files passed**, 6.26 seconds. Typecheck, frontend build (including typecheck), API build, lint and diff checks passed; existing lint and >500KB bundle warnings remain. No fresh `npm ci` run in this increment.

Disposable native PostgreSQL actual migration replay/session/token/HMAC/Hono lifecycle **1 test passed**, 6.22 seconds (4.32 test). Includes foreign/revoked access, CSRF, token denial, consent conflicts, signed evidence failure/deletion, stale remediation, expired-billing opt-out, 103-record partial window, 10/minute read budget and cancellation. Only the synthetic review database was reset; server stopped and stopped state confirmed. No Docker.

Integrated built-app synthetic QA on port 4370: real routes prepared original/rebuilt records, adopted reference and reviewed remediation. UI opt-in displayed two distinct artifacts, one passed/one failed record and one freshly absent finding. Nested event disclosure remained stable; export downloaded current private JSON; one-click opt-out removed the summary and reset consent. No horizontal overflow at 390/1365px; zero console errors. Screenshots `output/playwright/outcomes-mobile.png` (visually inspected) and `outcomes-desktop.png` are local synthetic review artifacts, not production/customer proof. This is not full keyboard/role/error or operational acceptance, and no customer retention uplift has been measured.

## 9 September 2026 — scoped agent tools and human-reviewed notes (after f1bab87)

Implemented fixed `agent-tools.ts`, `cli-mcp.ts`, `agent-access{,-schema}.ts` and `AgentAccessControls.tsx` through the actual CLI, Hono wrapper, signed-evidence adapter and release-detail panel. Migration `ra_008_agent_access` adds dedicated hashed credentials, scoped call budgets/audit, immutable draft identity and completed human review. Seven tools cover release discovery, status, evidence, comparison, anomalies, remediation context and optional pending draft notes. Current administrator/source/billing access and connection generations are rechecked; a revoked grant cannot be revived. Existing scan tokens and policy/receipt/alert permissions are unchanged. Human review stores the edited text separately from the original proposal and uses the existing remediation revision transaction.

Protocol research and exact operational boundaries are in `AGENT-TOOLS.md`. No paid provider, model sampling, external messages, remote MCP OAuth service, deployment or production migration. Metadata is untrusted, not a model instruction. Cancellation is cooperative, not a claim of database query preemption. A committed draft remains pending if cancellation races its commit. Broader multi-client/parallel-race/keyboard and operational acceptance remains open; optional provider explanations/cost contracts and retention outcomes remain unfinished.

Node 24.19.0, unchanged locked dependencies: final `npm test` **1,289 tests / 220 files passed**, 262.12 seconds. Earlier full run of this increment also passed (259.92 seconds); final run includes the approved-text UI correction. Focused protocol/stdio, UI and real-composition integration **10 tests / 3 files passed**, 3.14 seconds before the final presentation correction; covered again by final full suite. Typecheck (also part of frontend build), frontend/API builds, lint and diff checks passed with existing lint/bundle-size warnings. No new lint warning in the agent controls. No fresh `npm ci` claim for this increment; no dependency or lockfile changes.

Disposable native PostgreSQL migration replay and real Hono/session/token/signature lifecycle **1 test passed**, 3.24 seconds (1.66 seconds test). Covers read/write separation, accepted/stale/rejected proposals, token secrecy, update protection, rate/lifetime limits, expiry, revocation, connection generations, exact asset comparison, billing and deletion cascades. Native run precedes only the final read-model finding label/approved-text presentation changes; those are covered by the final full suite and browser. Only the verified synthetic review database was reset; no Docker/customer data. The native test server was stopped and its stopped state confirmed after verification.

Integrated built-app synthetic QA port 4368: stream and investigation creation, administrator grant, bearer-only tool draft, human-edited acceptance and revocation exercised. Deliberate post-revocation call returned 401 (expected console network error). Final fresh fixture port 4369, outbound disabled: current API/UI together, pending draft prepared through actual routes, human acceptance through UI, approved text/finding/reviewer visible, original draft separately disclosed. No horizontal overflow at 390/1365px and no console errors in final fixture. Screenshots `output/playwright/agent-mobile-reviewed.png` (visually inspected) and `agent-desktop-reviewed.png`; synthetic fixtures only, not customer or live-provider evidence. Next implementation: opt-in retention outcomes and minimal private event contracts; preserve broader acceptance work and provider-backed assistance as open, agency later.

## 9 September 2026 — durable remediation linkage (after 39ce185)

Implemented `release-intelligence/remediation.ts`, `release-remediation-{schema,service}.ts` and `ReleaseRemediationControls.tsx`, mounted through the existing release intelligence panel in both release-detail paths. `ra_007_remediation` adds an original-snapshot/finding case and immutable investigation/review/verification/reopen events. Session-authorised people can record a reviewed change URL, full commit hash and declared review time, then explicitly link a recorded rebuilt artifact. Existing Coverage remediation PR tooling remains the creation workflow; this increment neither calls providers nor merges PRs.

The result is scoped: selected finding/rule absent in a different, later, 24-hour-fresh signed artifact under the same source/channel/format/engine/policy. A moved finding under the same rule remains observed. Suppression, holds, inconclusive or stale evidence, website observations and contradictory signed commit metadata cannot verify this rebuild. Connected assets must match the exact selector, not merely the repository. Human review/build linkage is explicitly not provider-attested causal provenance. Other findings remain visible. Read-time re-evaluation prevents deleted or stale evidence from continuing to support a current result. Original receipts and alert states are unchanged; deleting original evidence cascades the case/events, and deleting a rebuild makes its linked observation unavailable. Existing tokens do not acquire access to human notes.

Node 24.19.0: final full regression **1,279 tests / 217 files passed**, 259.85 seconds. Focused domain/UI/real-composition integration **19 tests / 3 files passed**, 3.12 seconds (before the final token-read denial, included in the full/native runs). Typecheck, frontend/API builds and lint passed with existing warnings; no dependency changes. Native disposable PostgreSQL passed the complete upload/connected-asset integration **1 test**, 3.42 seconds (1.69 seconds test), including migration replay, revision contention, auth, source selection, expiry/read access and deletion. An earlier test attempted to alter completed evidence; the existing immutability guard correctly rejected it. The test now asserts that protection, rather than weakening the guard.

Integrated synthetic browser, isolated port 4367/outbound disabled: created stream/investigation, recorded human review, navigated to a separate clean rebuilt upload, captured it into the same stream and verified the linked observation. No overflow at 390/1365px; zero console errors. Screenshots `output/playwright/remediation-mobile-verified.png` and `remediation-desktop-verified.png` (desktop visually inspected). QA fixture adds a synthetic clean rebuild only. Native PostgreSQL stopped after verification. No live-provider/production/deployment proof. Remaining: broader workflow/accessibility/operational acceptance and provider-attested change/build provenance; next implementation is agent/MCP tools, then retention outcomes and only later agency work.

## 9 September 2026 — connected-source gate access (after 34747bc)

Added explicit expiring, revisioned grants for an existing workspace token and an exact connected release asset selector. Only the gate route uses this capability: general history, receipts, source browsing, policy adoption and overrides remain unavailable to the token. Each request checks current granting-administrator authority, token status, source identity and repository/package plus installation connection generations. Renewal cannot revive a decision bound to a previous grant. Migration `ra_006_gate_ci_access` adds grant storage, decision capability binding and an installation lifecycle counter. No grant is enabled by migration. CLI `gate` accepts either `--release` or `--upload`; the connected release controls allow explicit grant, renewal and revocation without displaying token secrets.

An earlier full run caught installation disconnect/reconnect retaining access (1 failed, 1,259 passed). The installation lifecycle counter fixes that regression. On the final runtime tree, focused gate-access/schema tests passed **23 tests / 2 files**, 16.30 seconds; native disposable PostgreSQL passed the real Hono/session/token/CLI lifecycle integration **1 test**, 2.26 seconds (1.11 seconds test). Final full `npm test` passed **1,260 tests / 214 files**, 261.60 seconds. Typecheck, frontend build, API build and lint passed (existing lint and bundle-size warnings retained). No dependency changes or fresh locked-install claim. The full run precedes only a confirmation-copy correction: it now says other token permissions are unchanged. That copy passed **2 component tests**, 933 ms, and a fresh frontend build.

Built-app synthetic QA port 4366, ephemeral data and external requests disabled: actual token creation, connected release stream creation, explicit grant and mobile revocation succeeded. Desktop 1365px/mobile 390px had no horizontal overflow or console errors. Local screenshots `output/playwright/gate-access-desktop.png` and `gate-access-mobile-revoked.png` were captured; mobile visually inspected. They precede only the confirmation-copy correction. Native PostgreSQL stopped after testing. No production acceptance, live CI/provider proof, merge or deployment. Next: broader race/accessibility acceptance and durable remediation linkage, then agent/MCP and retention outcomes.

## 9 September 2026 — versioned gate and production race acceptance (after c25942b)

Implemented `release-intelligence/gate.ts`, `release-gate-schema.ts`, `release-gate-service.ts`, `cli-gate.ts` and `ReleaseGateControls.tsx`, connected to real intelligence routing/migrations and the existing CLI. `ra_005_release_gate` adds append-only policy revisions, five-minute decisions, audited overrides and one-use consumption. The verified adapter reuses the canonical `assessRelease` function; the gate adds explicit age/build-scope limits. Advisory/warn are labelled not enforced, while enforce requires ready evidence or a valid explicit override. Unknown/stale evidence and holds cannot be overridden. Rollback creates a new revision. Original scanner results/receipts and token permissions are preserved.

Actual connected tests exercise Hono, sessions, tokens, HMAC receipts, CSRF/viewer/foreign rejection, competing policy adoption, concurrent single-use consumption, idempotent requests, policy invalidation, rollback, stale evidence, unknown override denial, blocked override, token revocation, CLI consumption and original deletion cascades. The final focused extension covers five-minute expiry and consuming the explicitly reviewed decision through `runGate`. The native PostgreSQL gate scenario passed before only the final warning-field/CLI warning additions and those test extensions: 1 test, 1.48 seconds (607 ms test). A separately reset disposable database passed the production observation cancellation, membership revocation and lost-lease/replacement cases: 1 selected, 1 skipped, 2.45 seconds (872 ms test). Its instance was stopped and data removed. No Docker or production database.

Node 24.19.0: initial full regression passed **212 files / 1,257 tests**, 264.17 seconds. Final focused gate domain/UI/integration passed **5 tests / 3 files**, 2.76 seconds, and typecheck passed. Final full run after warning/expiry updates passed **212 files / 1,257 tests**, 256.12 seconds. Frontend/API builds and lint (warnings, no errors) passed; CLI `gate --help` exposed the intended options. The CSS-only checkbox alignment correction made during that final run has its own successful frontend build and post-build browser verification; no underlying logic changed in that correction. Locked dependencies are unchanged.

Built-app browser, isolated ephemeral QA port 4365 with outbound network disabled: real uploaded stream creation, enforce-policy adoption, blocked evaluation and explicit override all succeeded. The result stayed blocked with an override label; no original evidence was changed. Mobile 390px had no overflow; no console errors. Screenshot inspection found inherited checkbox centring, corrected to inline 16px controls using the React review/accessibility guidance. Local synthetic screenshots: `output/playwright/gate-mobile-override.png`, `gate-desktop.png`; post-correction `gate-desktop-final.png` and `gate-mobile-final.png` were captured, with 16px inline checkbox measurements, no desktop/mobile overflow and zero console errors. This is not a full keyboard/role/browser matrix or live CI deployment proof.

Remaining: scoped connected-source CI grants (existing tokens intentionally remain limited), wider governance/expiry/revocation races, complete browser accessibility and operational rollout; then durable remediation, agent/MCP and retention outcomes. No automatic CI changes, production policy activation, merge, main push or deployment. PR #44 stays draft.

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

## Gate C — Alerts filters and responsive settings, 9 September 2026

Aligned the Alerts status/assignment bar with master-flow: visibly selected lifecycle tabs, independent ownership toggle and wrapping controls. Tablet shell uses its existing accessible drawer below 1024px; trial text stays on one line. Notifications fields stack on mobile; destination/confirmation text and actions wrap, retaining destination-specific accessible names. Owner sidebar decisions and all mutation semantics remain unchanged.

Independent verification: Alerts focused set (alert-filters-keyboard, watch-accessibility, workspace-alerts-rendered, alert-response-permissions-ui, alert-off-page-detail, watch-architecture) passed 25 tests/6 files; workspace-notifications-ui passed 5; artifact-shell-navigation passed 1. Added stateful lifecycle arrow/Home/End focus and independent ownership coverage; removed two obsolete class-name assertions. Frontend TypeScript/Vite build passed (existing large-chunk warning). No full suite or API rerun for this presentation batch.

Signed-in Codex browser on 4347: inspected Alerts at 390/768/1024/1440 CSS widths; mobile selection opens detail with Back action, no observed horizontal document overflow. The initial tablet header squeeze led to the shell correction. Final 768px drawer opens; Escape closes and returns focus to its trigger. Notifications at 390px now has full-width fields and honest unconfigured-provider/empty states. No destination was created and no delivery sent: populated long-destination and disconnect wrapping are source-level changes, not live-provider verification. Server/database/session preserved without restart. Full Gate C, contrast/200% zoom and wider screen/state acceptance remain open.

## Gate C — evidence-first release detail, 9 September 2026

Uploaded release detail now places findings and artifact facts before supporting assurance/history. A compact In this release navigator focuses and scrolls to Findings, Release tools, Artifact details and conditional Proof sharing. Clean empty evidence no longer asks for a nonexistent finding; inconclusive empty evidence explicitly remains nonpassing. Canonical assessment callbacks and private sharing defaults are unchanged. Intelligence identifies the selected historical record before actions and distinguishes stream settings, displayed-release tools and selected-history tools.

Focused verification: initial brief/intelligence/history-mount run had 26 pass/1 effect-timing assertion failure. Waiting for the existing imperative-render effect corrected that test; history-mount alone passed 7/7. Final navigation and nonpassing-empty regressions passed uploaded-release-brief-ui 9/9; intelligence retains 13 passing cases including historical scope ordering and correct gate/agent binding. These staged runs cover 29 current cases, not one combined all-green run. npm run build and npm run lint passed with existing warnings; git diff --check passed. No full suite repeated.

Real signed-in 4347 verification: evidence precedes assurance/tools; Review evidence focuses its heading; section navigation focuses Release tools at normal desktop width and Findings at 390px with no document overflow. Selecting a real older saved history record shows the different-record warning before grouped tools while the displayed release remains unchanged. No gate, grant, baseline, provider or sharing mutation occurred. Server preserved without restart. This closes this navigation/scope batch; remaining Gate C routes and wider accessibility/fidelity acceptance are still open.

## Gate C — Coverage, Timeline and Scan keyboard batch

Coverage rows keep icon/name together at390px, wrap long identity/details and align actions; source filters use neutral selection and44px targets. Timeline wraps long event/source text. Its chart now describes alert activity rather than claiming missing-release warnings are exposure, styles severity separately from response, uses calendar dates for windows over7days, and exposes a labelled keyboard scroll region/text equivalent. Empty charts say no activity, not all closed. Scan evidence tabs now support arrows/Home/End, roving focus and labelled tabpanel while preserving form state/context.

App-only dim token changed from71717a to92929c: calculated sRGB contrast on111113 panel improves3.90:1→6.12:1; on292930 selected background4.69:1. Actual browser computed token confirmed. Homepage token unchanged. This is a specific text contrast fix, not a whole-app WCAG claim.

Focused coverage-detail-ui1/1, scan-submission-navigation-ui18/18 and final watch-exposure-chart-ui3/3 pass. Existing source-lane timeline model case passed separately (other35 cases skipped). New tests cover keyboard scope/no submission, warning honesty, scroll region/text equivalent and long-window dates. npm run build and npm run lint pass with existing warnings; diff check passes. No full suite repeated.

Signed-in4347 browser: Coverage and Timeline document width390 without overflow; source names wrap. Scan ArrowRight focuses/selects Package tab with its associated panel. Timeline chart focused arrow scroll moved40px inside330px viewport/620px content; document remained390px. Real24 missing-release alerts are called warnings/open alerts, not critical exposure. No scan or provider mutation. Server/session/database preserved. Broader Gate C screen/state, zoom and accessibility acceptance remains open.

## Gate C — settings and route focus milestone

Team/token identities and actions wrap; token cards/fields fit narrow screens. Policy uses a proper padded settings form instead of empty-state styling, with readable multiline labels and fixed checkbox targets. Portalled watch rail now receives the same readable dim token as the app shell. Real route changes focus a labelled content region; initial loads and same-view query changes retain focus. Closing mobile drawer teardown is observed before transfer; unrelated dialogs retain focus.

Combined UI milestone: npm test -- tests/workspace-team-ui.test.tsx tests/workspace-tokens-ui.test.tsx tests/workspace-scan-policy-ui.test.tsx tests/artifact-shell-navigation.test.tsx tests/workspace-notifications-ui.test.tsx tests/alert-filters-keyboard.test.tsx tests/watch-accessibility.test.tsx tests/workspace-alerts-rendered.test.tsx tests/alert-response-permissions-ui.test.tsx tests/alert-off-page-detail.test.tsx tests/watch-architecture.test.ts tests/uploaded-release-brief-ui.test.tsx tests/release-intelligence-panel.test.tsx tests/release-assurance-history-mount.test.tsx tests/coverage-detail-ui.test.tsx tests/scan-submission-navigation-ui.test.tsx tests/watch-exposure-chart-ui.test.tsx — 105 passed/17 files,7.63s. Later padding/rail token/policy wrapper-only adjustments have final successful frontend build and rendered review, not a repeated105-test run. Diff check passed; existing build chunk warning remains.

Signed-in browser: mobile drawer Team→Scan API tokens closes and focuses Scan API tokens page; desktop sidebar Policy focuses Policy & allowlist page. Policy final390px layout has readable labels, no document overflow; token/team forms inspected without mutations. Earlier drawer computed dim71717a identified missing portal inheritance; scoped rail override corrects it without homepage changes. No token/invitation/policy mutation or server restart.

Historical gap, now addressed by the Overview/release-browser milestone above: Releases rendered Saved attempts plus a full connected-revision browser, repeating connected upload artifacts and exposing raw upload coordinates. These are intentionally distinct persisted records; do not delete/deduplicate blindly. A single visible browser with accessible Saved attempts/Connected revisions tabs can preserve filters, exports, pagination and direct links. The investigation-only status is superseded by the milestone above. Remaining Gate C acceptance includes outstanding viewport/zoom combinations and representative visual states; do not call the whole goal complete.

## 9 September 2026 — approved quiet Overview integration

Owner approved mockup 23 from supplied desktop references. ArtifactOverview now uses four rounded number-first cards, quieter surfaces, larger supporting text, open recent-attempt rows and a centered layout. Existing sidebar, first-proof flow, archived/error recovery, polling, workspace identity and scoped navigation remain. Cards show retained attempt counts (attention/passed/total/active); they do not relabel policy passes as clean findings or fabricate the prototype's check-history strip. Connected monitoring and alert-response controls remain available below saved evidence.

Verification: `npx vitest run tests/artifact-overview-ui.test.tsx tests/overview-next-action.test.ts` — 30/30 pass, two files, 1.69s. `npm run build` passes including TypeScript; existing >500 kB warning. Affected-file oxlint has no errors and one pre-existing redundant boolean-cast warning. `git diff --check` passes. Signed-in Codex tab on 4347 visually rendered expanded sidebar plus four real counts (1/3/4/0); clicking Need review reached the correct workspace release URL with uploadStatus=attention. Returned to Overview and collapsed sidebar. Compiled app restarted using preserved private launcher and existing database/GitHub connection. No scan or external mutation. Mobile CSS reflow is implemented but not browser-verified in this batch. Gate C broader acceptance is not declared complete.

## 9 September 2026 — approved mockup 28 connected Overview

Owner selected mockup 28 over the beUI-component experiment. The real Overview now implements its graphite panel system, capsule controls, next-action/coverage composition, two primary totals, sliding alert queue, paired activity panel, release cards and evidence-summary drawer. The existing app top glow and sidebar are preserved. The shell's existing New scan action remains the single scan entry; no notification demo or fake loading state is mounted in the real app.

All data is read through existing authorized endpoints. Needs attention reads the selected workspace's alert queue, limits display to three records and links exact workspace/alert/status identities. Operational alerts use “Check incomplete” and a readable saved title when no repository name is supplied. Activity uses only a connection returned by the workspace Overview, honors the existing Team/trial endpoint response, and buckets the returned timeline's alert/response events into UTC 7/30-day windows. The caption states the 200-event bound; response events are not resolved totals or successful scan history. The coverage ring measures recently checked sources, not the mockup's invented setup progress or release safety. Release summaries retain upload/connected separation and link to existing full evidence.

Verification: the three-file focused command (`npx vitest run tests/artifact-overview-ui.test.tsx tests/overview-next-action.test.ts tests/overview-activity-ui.test.tsx`) passed 38 cases in 2.04s. The subsequent readable-title correction added one regression; its affected file passed all nine cases in 1.19s. This is 39 covered cases across the batch, not a new backend/full-suite run. Final `npm run build` passed including TypeScript with the existing >500 kB warning; affected-source/test oxlint and `git diff --check` passed without errors/warnings. No dependency or server/API implementation changed.

Signed-in Codex browser: real 4 retained attempts, 24 open alerts, 88 recently checked sources and 24 opened timeline events were rendered. Exact alert navigation reached workspace alert 24; the saved evidence drawer showed the 11:20 attempt and full evidence URL reached upload `6f7e4c8c-0bd1-48e8-84c2-b5f10487dcd6`. At 390×844 the document width remained 390px, Overview width 340px and drawer width 366px. ArrowRight selected In progress; Escape closed the drawer and restored focus to its source card. Default viewport restored. These are targeted desktop/mobile interaction checks, not a whole-app accessibility or new-scan assertion.

The compiled app was restarted through the same private preserved launcher, database and GitHub connection on port 4347. Current server exec session: 8656. No scan submission, evidence mutation, production deployment or paid provider activation occurred. Earlier mockup experiments and unrelated uncommitted files remain untouched.

## 9 September 2026 — Overview panel refinement

Owner approved removing main panel outlines and reducing panel corners to 16px. Next-action, metric, coverage and activity/attention surfaces are now borderless; release cards retain their faint outlines. Panel/drawer corners are consistent at 16px; capsule buttons and alert tabs remain rounded. CSS-only change: production build/typecheck and diff check passed, with the existing chunk warning. Signed-in browser computed styles confirmed 16px corners and zero main borders, and a screenshot verified the result. No repeated functional suite was needed. Preserved local server restarted; current exec session 93841.


## 9 September 2026 — tighter panels and beUI Select

Owner requested further corner reduction and the actual beUI motion Select. Overview panels now use 10px corners, matching existing app panels; main panel borders remain absent. Activity range uses the upstream MIT Select with Motion 13.2.0 pinned, dark app styling, reduced-motion support, keyboard navigation, disabled-option skipping and focus recovery. Shared primitives are reusable; other app dropdowns have not been migrated. License retained in docs and public/licenses/beui.txt.

Verification: `npx vitest run tests/beui-select-ui.test.tsx tests/overview-activity-ui.test.tsx` passed 11/11 in two files (1.65s). Affected-file oxlint clean; `npm run build` passed including TypeScript with existing chunk-size warning; diff check passed. Signed-in existing Codex tab confirmed borderless 10px Activity/Attention panels, visible dark dropdown and Last 30 days selection. No mobile verification or full-suite rerun claimed. Preserved launcher restarted the same app/database/GitHub connection on 4347 (session 29809). No evidence or policy mutation.


## 9 September 2026 — quiet mockup typography and controls

Matched mockup23's font stack in the Watch shell and portalled sidebar, increased sidebar navigation icons from15px to19px and labels to14px, and changed Overview action buttons to8px corners with the mockup's neutral primary fill. Selected response tabs retain their approved segmented shape. Homepage typography remains unchanged. `npm run build` passes with existing chunk warning; diff check passes. Actual signed-in browser confirms19px sidebar SVGs, the requested font stack and8px primary button corners; screenshot inspected. Presentation-only change, no repeated functional suite or server restart.


## 9 September 2026 — approved quiet structure integrated

Mockup30 now informs live Overview: uniform dark10px cards with fine outlines, coverage/header/metadata dividers, labels above counts, aligned card spacing,8px actions and tighter response segments. Removed stacked release-card decoration. Summary status spans preserve actual counts: policy passed green, needs review coral; failed attempt labels red. Existing data, navigation, chart, beUI Select, sidebar and coverage meaning are preserved; prototype setup progress and illustrative records were not copied.

Verification: `npx vitest run tests/artifact-overview-ui.test.tsx` passed22/22 (2.28s). `npm run build` passed including TypeScript (existing chunk warning); diff check clean. Signed-in desktop screenshot/computed colors verified the actual3 passed/1 review summary and22 open alerts.390px rendered without document overflow; desktop restored. No server restart or data mutation.


## 9 September — component foundation

HTML brief/showcase31-design-system.html created with illustrative foundation, actions, statuses, metrics, fields, lists and empty/unavailable states. Added reusable QuietPanel, QuietAction and QuietStatus with scoped CSS; Overview status summary now consumes QuietStatus. Other compositions remain proposals, not completed app-wide migration. Existing beUI Select remains the production dropdown. Frontend build and22 Overview tests pass; diff check clean. Showcase opened in Codex browser. No server restart or provider/data mutation.


## Header identity before search

Moved the route icon/title before search and removed the duplicate desktop title. Shared route icon selection with sidebar; mobile retains navigation trigger and truncated page label. Final navigation tests3/3 and frontend build pass after correcting an initial helper return-line error; diff check clean. Signed-in desktop screenshot verified placement, compact browser document matched viewport width; restored viewport. No server restart or data mutation.


## Header trial placement

Owner requested plain trial text beside the page title. Moved the coverage label before the flexible spacer; removed its pill/animation and retained hidden-on-mobile behavior. Search now aligns with right-hand actions and has a compact visible placeholder. Final frontend build and3/3 navigation tests pass; signed-in screenshot confirms title/trial left and search/actions right.


## App-wide quiet styling and search presentation

Shared Watch-scoped design stylesheet now applies approved charcoal surfaces, fine borders,10px cards,8px controls, system typography, heading hierarchy and form styles across existing app screens. Shared Card/Button get style hooks; Watch portal dialogs inherit the same tokens. Marketing homepage is outside this app-scoped pass. No scan, role, billing, policy or search-result semantics changed.

Search retains buildPaletteItems, permission filters, scoped navigation and Headless UI focus management. Added Motion spring-shell opening from the header trigger, adapted from the public MIT beUI morphing-search pattern (https://beui.dev/r/morphing-search/raw); existing beUI license retained. It is an adaptation, not the full upstream standalone component. Reduced motion disables the transition. Explicit input label and keyboard hint added.

Focused milestone: watch-accessibility, artifact-shell-navigation, artifact-command, workspace-team-ui, workspace-tokens-ui, workspace-notifications-ui, workspace-scan-policy-ui, uploaded-release-brief-ui:42 tests/8 files passed (4.01s). Final npm run build passed including TypeScript with existing chunk warning. Affected-file lint: no errors; two existing route-icon static-component warnings. Signed-in browser inspected Releases, Team, Coverage, Alerts and search; compact document width355 matched viewport355, search fit and Escape closed it. Final CSS also aligns release-heading weight and removes redundant input focus outline inside the focus-marked search shell. This is shared styling plus representative review, not exhaustive every-state accessibility acceptance or migration of every native select.


## App page compositions — 9 September

Owner confirmed all app pages. On top of the shared quiet system, Team now prioritises members with an adjacent invitation form, compact identities, pending invitations and separated activity. Notifications and Tokens separate creation from current records and history. Audit/retention records use compact metadata and fine row dividers; independent policy choices are visually separated. Route-scoped layouts refine Alerts tabs/queue, saved-release previews, Timeline metrics/events, and Setup/Health/Registry spacing. Connected release statuses now sit below filenames instead of squeezing them into a few characters. Removed the remaining Coverage inline skeleton blocks. Existing authorisation, mutations and evidence semantics are unchanged.

Verification: focused seven-file milestone passed45/45 (workspace-team-ui, workspace-notifications-ui, workspace-tokens-ui, workspace-evidence-settings-ui, workspace-alerts-rendered, uploaded-releases-ui, watch-exposure-chart-ui;3.79s). After final Team accessible-label and policy markup changes, team and scan-policy tests passed15/15 (1.44s). npm run build passed including TypeScript with the existing chunk warning. Affected settings/Timeline lint passed. Signed-in browser inspected Team, Notifications, Coverage, Timeline, Alerts and connected Releases; final filenames wrap and status is below. Team at actual390px had document width390; desktop viewport restored. Selected Alert tab count was darkened for its light selected background. No data mutations or server restart. This is a page-composition increment, not exhaustive every-state accessibility acceptance or a claim that all deeper release tools have been redesigned.


## Coverage and activity structure follow-up

Coverage now has real total/attention/checked-at-least-once summaries, a quieter filter bar and source rows with separated identity, check timestamps and alert counts. Checked-at-least-once is explicitly not freshness or safety. Timeline presents recorded activity directly; the full source chart remains available in a native disclosure. Existing routes and actions preserved.

Focused source-monitoring tests5/5 passed (1.23s); final build including TypeScript and affected lint passed, existing chunk warning only. Signed-in screenshots verified88/34/88 Coverage summaries, responsive390px document without overflow and actual26-event timeline. No new synthetic history, mutation or server restart. Other deeper page compositions remain subject to further design review.


## Release tool scope design

Moved current-release gate/remediation ahead of stream settings and grouped current-record, selected-history and stream-wide tools in distinct quiet panels. Preserved component keys, record arguments and administrator conditions.13 release-intelligence-panel tests passed (1.92s); frontend build passed with existing chunk warning. Signed-in real upload detail confirmed the grouped layout. No mutation or source/provider changes. Acceptance now names mockup30 as the current reference; prior mockup28 text is historical.


## Search keyboard visibility

Command selection now scrolls the active option into view and removes options from the Tab sequence, retaining combobox focus ownership. Actual signed-in browser End selected Finish setup and scrolled the list; screenshot showed the complete option (bounding rect rounding difference0.12px). Escape removed the dialog and restored the header search trigger. Focused accessibility/command checks and build recorded in this batch; reduced-motion handling remains source-covered, not OS-emulated evidence.


## Shared tool-group component and PR synchronization

Extracted the three release-tool scope sections into QuietToolGroup, preserving rendered headings, descriptions and children. Build/typecheck and diff check passed; lint has three existing history effect warnings and no errors. Reused the immediately preceding13-case history verification because this is a markup-preserving extraction. PR44 was read as draft on the expected branch and its outdated mockup28 section replaced with current Quiet Structure scope, separate focused checks and explicit C1–C3 limits. No draft-state change.


## Optional capability cards

Setup now lays optional capabilities out as responsive cards with evidence icons rather than numbered sequential steps. Removed duplicated recommended-step description and retained existing proof, next-action and route decisions. Five source-monitoring UI cases passed (1.54s); final build and diff check passed with existing chunk warning. Real signed-in desktop showed2/5 evidence states and all five capability cards; compact actual355px matched document width355 with wrapping and single-column cards. Desktop restored. No connection or scan action invoked.


## Connected Scan priority

For signed-in selected installations, Scan now leads with checking a connected release and the existing repository picker. Additional GitHub connection is a secondary disclosure below the picker; first-time sign-in/connect paths are preserved.19 scan-submission-navigation UI tests passed (1.75s), final build passed with existing chunk warning, diff check clean. Real signed-in desktop confirmed updated heading and picker-first order. No scan submission, connection mutation or server restart.


## Shared named evidence tables

Added EvidenceTable for workspace audit and uploaded file manifest: consistent fixed-layout wrapping, screen-reader caption and explicit column-header scopes.13 focused evidence-settings/uploaded-brief tests passed (1.91s), build passed with existing chunk warning. Actual signed-in64-file manifest caption/headers inspected; compact355px document matched viewport and visible cells wrapped. Desktop restored. This is semantic/browser evidence, not audible screen-reader execution.


## Direct Coverage evidence correction and current matrix

Auditing test ownership showed source-monitoring-ui tests target mutation controls, not WatchSourcesSummary. Those earlier five-case results must not be read as direct Coverage/Setup rendering coverage. Added direct inventory-vs-filter totals verification in coverage-detail-ui; both cases pass (1.24s), including existing distinction between metadata and scan timestamps. No runtime source changed, so no redundant build. GATE-C-CURRENT-MATRIX.md records direct checks, existing visual evidence and remaining C1–C3 gaps by route. Gate C remains partial.


## Connected audit empty state

Real connected audit is empty; no populated audit evidence is claimed. Added reusable QuietEmptyState and replaced the empty count/secret-stat panel with explanatory content. Row statistics appear only for a ready nonempty result, avoiding false zero while loading/error. Build passed and real empty screenshot reviewed. Removed an existing trailing unused undefined expression; no export or backend behaviour changed. This closes empty-state presentation, not populated audit review.


## Policy live reflow verification

Read-only signed-in policy review: independent strict/approval labels and complete conditions fit390px; expanded GitHub connection policy settings and signing inputs also fit390px, document width390. No checkbox, save, exception or policy mutation. Desktop viewport restored. Initial heading lookup found nothing because the connection settings disclosure was closed; opened the visible disclosure before inspecting. This closes those precise presentation rows, not the remaining exception confirmations or audible AT requirements. No source edit or repeated tests/build needed.


## Exception form tablet design

Actual768px review showed the five-column direct exception form squeezed its reason field. Changed to two columns above the small breakpoint, preserving native fields, validation and submit handler; added a form name. Final build, lint and diff check passed. Signed-in768px screenshot shows readable fields, document width768, and Write exception still focuses policy-exception-rule. No field values changed or submission occurred. Desktop restored.


## Remediation action prerequisites

Made the existing eight-character shared-note requirement explicit beside the note and disabled review/rebuild actions; added review-field guidance. No validation or declaration authority changed. Nine remediation-control tests passed (1.36s), build and diff check passed. Actual saved case review disclosure visibly explains disabled recording; no note/review/verification was submitted. This addresses the owner's earlier unexplained disabled-button friction without inventing human review.


## Quiet redesign cumulative UI milestone

At488a9b2, ran the existing38-file cumulative UI command recorded above:259 passed/2 failed,261 cases,18.07s. Failures were the blanket core-disclosure source ban (now narrowly permits only the optional Timeline chart) and a gallery test that included untracked files despite its committed-file contract. Corrected inventory to git-tracked HTML; this exposed a genuine missing31-design-system link, now added. Final architecture file13/13 passed (152ms). No runtime code changed after this run. These results are a cumulative run plus focused correction, not a fresh single all-green261-case run. Unrelated gallery edits preserved unstaged. Native zoom/AT and other matrix gaps remain open; do not rerun this milestone without new changes.


## Remaining loading animation cleanup

Source audit found two inline pulse bars in WatchOverview loading, outside shared WatchSkeleton. Removed them while retaining aria-busy and screen-reader statuses; initial lighthouse unchanged. Scan submission/receipt progress spinners now use motion-reduce:animate-none. Build initially exposed the previous test correction's unused readdirSync import; removed it, final build passed. No OS reduced-motion or live delayed-response simulation claimed. This is source/build verification; previous cumulative result remains distinct.


## Notifications shared destination selector

Replaced the native destination selector with the existing beUI Select, retaining busy locking and clearing private input on type changes. Added a direct regression for clearing without submission and focus return. Eight cases across notification/select tests passed (1.61s); initial run needed the existing ResizeObserver test stub. Live review caught transparent shared menu background outside Overview; fixed the shared panel to opaque charcoal with a fine border. Final build and diff check passed. Real signed-in desktop menu reviewed and Escape exercised; no destination saved or message sent. Broader Gate C remains open.


Shared Select follow-up: removed undefined beUI foreground/background/border/muted token references and supplied real app colours, including explicit keyboard focus rings on selected and unselected options. Final build passed; signed-in ArrowDown visibly focused Email with an inset ring, Escape closed without selection. CSS-only correction reuses preceding eight behavioural cases; no new suite claimed. Other native form selects remain pending.


## Team shared role picker

Invitation and member role controls now share a beUI-backed RolePicker. Allowed role sets are unchanged; invitation role explanations sit below the field. Busy state locks selection and selecting still requires explicit Save. Member list overflow permits the menu to remain visible. Fourteen focused cases across workspace-team-ui and beui-select-ui passed (2.04s), including admin role limits and no write on selection; final build and diff check passed. Real signed-in invitation and member menus reviewed, ArrowDown focus and Escape exercised; no invitation or membership mutation. Native zoom/AT and wider Gate C checklist remain open.


## Connected decision view hierarchy

HostedDecisionList now uses shared WatchPageHeader and QuietEmptyState, wrapping named outcome filters, selected-state emphasis and a scoped uploaded-history action. Four workspace-coverage-health cases passed (1.63s); build caught an unsupported variant, corrected to existing default/outline, then final build passed. Signed-in empty view reviewed and View uploaded scans confirmed workspace/install-preserving navigation to Saved attempts. Populated connected evidence is not present locally and is not claimed visually verified. Gate C remains open.


## Shared policy settings row

Extracted QuietSettingRow for the two independent policy choices, preserving presentation and save/permission boundaries. Each checkbox now references its explanatory text with aria-describedby. Four scan-policy cases passed (1.64s); final build/diff check passed. Actual signed-in page reviewed and both description references resolve to the correct existing explanations; no policy changed. This closes the concrete duplicate settings-row extraction, not universal C1 completion or screen-reader speech acceptance.


## Shared modal surface

QuietModalSurface now owns the identical backdrop, centred scroll container and panel used by Add coverage and plans dialogs. Existing Dialog owners/titles/actions remain intact. Build and diff check passed; real Add coverage rendering reviewed and Escape removed the dialog with focus returned to Add coverage. No source added or billing action. This is structural reuse with live dismissal evidence, not a fresh full interaction suite or full Gate C sign-off.


## Shared release decision panel

ReleaseDecisionPanel now renders the common connected/uploaded decision layout, with each caller retaining its own tone, icon, copy, actions and scope/count summary. Twelve focused uploaded/hosted evidence cases passed (1.91s); final build/diff check passed. Signed-in saved upload decision/provenance reviewed with policy-passed wording and separate production scope intact. Hosted populated visual state remains unavailable locally; no scan repeated.


## Shared side preview

QuietSidePreview now provides caller-owned Dialog presentation for Overview evidence and Coverage detail, retaining inset/full-height variants and existing focus/navigation owners.24 Overview/Coverage cases passed (2.15s), build/diff check passed. Real saved evidence drawer reviewed, Escape closed and returned focus to the exact initiating artifact button. No evidence mutation. Coverage detail remains covered by the focused component cases; no new live Coverage-drawer claim.


## Evidence type picker boundary

Extracted EvidenceTypePicker from ScanPage, retaining the four existing evidence choices, IDs, arrow/Home/End activation and caller-owned mode/navigation. GithubRepositoryScan remains the scoped repository selection/submission owner.19 scan navigation cases passed (2.21s), final build/diff check passed; actual signed-in picker reviewed and End selected/focused Verify release proof with mode=receipt while preserving workspace/install. No scan submitted.


## 10 September — combined shared-component milestone

At6d84d33, the40-file UI milestone completed272 passed/2 failed (274 cases,32.29s). The architecture assertion still expected picker text in ScanPage after extraction; it now verifies the mounted EvidenceTypePicker and its labels. An outcomes focus test saw initial data before the native disclosure toggle cleared/reloaded it; it now waits for the monthly request and actual opt-in control, retaining inside/outside focus assertions. Focused correction:21/21 cases across both files (1.45s). No runtime changes after the milestone. This is a cumulative run plus focused corrections, not a fresh all-green274-case run.

Command:
```sh
npm test -- tests/artifact-shell-navigation.test.tsx tests/watch-accessibility.test.tsx tests/watch-architecture.test.ts tests/workspace-entry.test.tsx tests/workspace-management-ui.test.tsx tests/artifact-overview-ui.test.tsx tests/first-proof-transition.test.tsx tests/scan-submission-navigation-ui.test.tsx tests/alert-queue-keyboard.test.tsx tests/alert-filters-keyboard.test.tsx tests/workspace-alerts-rendered.test.tsx tests/alert-response-permissions-ui.test.tsx tests/alert-off-page-detail.test.tsx tests/coverage-detail-ui.test.tsx tests/workspace-coverage-health-ui.test.tsx tests/watch-exposure-chart-ui.test.tsx tests/uploaded-releases-ui.test.tsx tests/uploaded-release-brief-ui.test.tsx tests/hosted-release-evidence-ui.test.tsx tests/release-workspace-scope-ui.test.tsx tests/release-intelligence-panel.test.tsx tests/release-assurance-history-mount.test.tsx tests/release-gate-controls.test.tsx tests/release-gate-access-controls.test.tsx tests/release-remediation-controls.test.tsx tests/production-parity-controls.test.tsx tests/automatic-capture-controls.test.tsx tests/agent-access-controls.test.tsx tests/release-outcomes-controls.test.tsx tests/release-explanation-controls.test.tsx tests/workspace-notifications-ui.test.tsx tests/workspace-scan-policy-ui.test.tsx tests/workspace-team-ui.test.tsx tests/workspace-tokens-ui.test.tsx tests/workspace-evidence-settings-ui.test.tsx tests/workspace-exceptions-ui.test.tsx tests/deletion-request-ui.test.tsx tests/settings-install-interactions-ui.test.tsx tests/beui-select-ui.test.tsx tests/overview-activity-ui.test.tsx
```

Source inventory: all visible JSX evidence tables use EvidenceTable; the only separate table in src/components/src/pages is the screen-reader-only chart text equivalent. C1 now has extracted heading, evidence picker, status, async state, evidence table, decision panel, side preview, empty state, centred dialog and settings-row components. This establishes component boundaries; it does not establish universal token/style compliance or close C2/C3. Current remaining work is the matrix, particularly latest responsive/state fidelity and actual motion/AT/native-zoom evidence.

Final `npx tsc -b` and `git diff --check` passed after the test corrections.


## Compact shared-control verification

At b4b45a2 runtime, signed-in Team member menu reviewed at actual355 CSS pixels with document width355. Requested390 viewport initially yielded355; adjusted tool viewport to429 and confirmed innerWidth390, innerHeight844. At actual390, Notifications open destination menu, connected decision filters/empty state, and Add coverage open modal were visually reviewed with document width390. All four modal source choices were visible; Escape dismissed, then normal viewport restored. No source/account mutation. This is CSS viewport evidence, not native200% zoom, and does not cover every state/width. No tests/build repeated for this read-only check.


## Dropdown widths and contrast

At c8a95bd, live open Team invitation and Notifications destination menus had exact document/viewport equality at768,1024,1440 CSS pixels. Team screenshot reviewed at768/1440; Notifications screenshot at768; other widths are geometry evidence. Closed menus and restored viewport. No writes. Defined dropdown contrasts (sRGB WCAG calculation): f4f4f5/111214=17.05:1; b1b1ba/191a1d=8.18:1; a1a1aa/191a1d=6.79:1; f4f4f5/303134=11.83:1; focus a1a1aa/303134=5.07:1 (selected background approximates 10% white over191a1d). These cover the new dropdown palette, not whole-app contrast. Native zoom, spoken AT and actual reduced-motion execution remain distinct gaps.


## Typography and reduced-motion component execution

Live app and approved mockup30 both report `Inter, -apple-system, system-ui, Segoe UI, sans-serif`, with document.fonts empty in each current browser document. Preserved this approved fallback rendering; no claim Inter is bundled/loaded. Added two rendered checks with Motion useReducedMotion explicitly returning true: search initially fully visible without transform and focused combobox/End selection, plus select keyboard selection/focus return. Both passed (1.30s), typecheck passed. These exercise the reduced-motion component branches; they do not emulate OS media preference or establish whole-app animation compliance. No runtime change or repeated build/scan.

## 2026-09-10 — Page-transition scroll flash

Moved route-view scroll reset into a layout effect before paint, with instant top/left positioning. Delayed accessible focus restoration no longer changes scroll; query-only navigation and modal focus ownership remain unchanged. No loading interstitial added.

Verification: `npx vitest run tests/artifact-shell-navigation.test.tsx` — 4/4 passed (1.48s); `npm run build` passed (existing bundle-size warning). Signed-in Codex browser reloaded the built frontend; overview scrollTop 802 followed by Timeline navigation yielded timeline scrollTop 0. This verifies the scroll-offset flash fix, not every possible asynchronous layout shift. Server/database/connection preserved.

## 2026-09-10 — Token confirmation focus

WorkspaceTokens now moves focus to the exact-name confirmation input on Revoke, restores the initiating button on Cancel, and focuses Token history after success only while focus remains inside the removed form. Confirmation form has an accessible name. Existing permissions, exact-name check and requests unchanged.

`npx vitest run tests/workspace-tokens-ui.test.tsx`:7/7 passed,1.28s; `npm run build` passed with existing chunk warning; diff check passed. Signed-in rebuilt empty token page screenshot reviewed. No real token created/revoked; populated keyboard sequence is rendered component evidence, not live credential lifecycle verification.

## 2026-09-10 — Remediation prerequisite navigation

Remediation follow-up: review/rebuild prerequisites now include Add required note, which focuses the shared note field; note guidance is programmatically associated. Ten remediation controls cases passed (1.60s), frontend build passed, and real saved-release click focused/scrolled the note into view. No mutation. Remaining Gate C scope is unchanged.

Commands: `npx vitest run tests/release-remediation-controls.test.tsx`, `npm run build`, `git diff --check`. Build retains the existing bundle warning. Live uploaded release6f7e4c8c-0bd1-48e8-84c2-b5f10487dcd6: expanded remediation/review; Add required note focused TEXTAREA labelled Remediation note (no secrets), top444 CSS pixels in the viewport. Screenshot reviewed. No text entered or action submitted.

## 2026-09-10 — Shared palette inventory

Shared component inventory is now in GATE-C-COMPONENT-INVENTORY.md. Shared design styles use Watch palette tokens for matching values. Build and real settings/Overview computed-colour checks pass; domain-specific styles outside design/ still require consistency review. No whole-gate completion claim.

`npm run build` passed with existing bundle warning; diff check passed. Rebuilt live token history computed background rgb(17,18,20), border rgba(255,255,255,0.055), text rgb(244,244,245); screenshot reviewed. Overview QuietStatus computed passed rgb(63,185,80), review rgb(255,138,128). No behavioural suite repeated for exact-value CSS refactor.

## 2026-09-10 — Release form intrinsic overflow

Release-tool responsive fix: native selects with long options could exceed their grid labels despite document width matching the viewport. Labels now use minmax(0,1fr); text controls have min-width:0 and width:100%. Build passed. Expanded remediation review/rebuild controls measured zero clipped controls at actual390/768/1024/1440; compact and desktop screenshots reviewed. No mutation; native zoom remains separate.

Before: at429px, labels311px but Gate mode/select373.6px, remediation case620.6px and rebuild630.6px; document width alone concealed clipping. After: `.ns-intelligence` select/input/textarea right bounds stayed within every tested viewport. `npm run build` and diff check passed; existing bundle warning. No behavioural tests repeated for grid-sizing correction. Viewport reset after review.

## 2026-09-10 — Current UI integration milestone

Current-source UI milestone at8d4e658:279/279 tests across41 files passed (19.94s). This supersedes the earlier partial40-file result. Repository lint exited0 with29 warnings; final runtime build already passed for8d4e658. No runtime change in this evidence update. Reuse this milestone until further substantive changes. Gate C remains partial for final domain-style/state parity and external native zoom/audible AT.

Justification: cumulative validation after route prepaint scroll, token confirmation focus, remediation note navigation, shared CSS token consolidation and release-control overflow fixes. No backend scan or provider action repeated.

```sh
npm test -- tests/artifact-shell-navigation.test.tsx tests/watch-accessibility.test.tsx tests/watch-architecture.test.ts tests/workspace-entry.test.tsx tests/workspace-management-ui.test.tsx tests/artifact-overview-ui.test.tsx tests/first-proof-transition.test.tsx tests/scan-submission-navigation-ui.test.tsx tests/alert-queue-keyboard.test.tsx tests/alert-filters-keyboard.test.tsx tests/workspace-alerts-rendered.test.tsx tests/alert-response-permissions-ui.test.tsx tests/alert-off-page-detail.test.tsx tests/coverage-detail-ui.test.tsx tests/workspace-coverage-health-ui.test.tsx tests/watch-exposure-chart-ui.test.tsx tests/uploaded-releases-ui.test.tsx tests/uploaded-release-brief-ui.test.tsx tests/hosted-release-evidence-ui.test.tsx tests/release-workspace-scope-ui.test.tsx tests/release-intelligence-panel.test.tsx tests/release-assurance-history-mount.test.tsx tests/release-gate-controls.test.tsx tests/release-gate-access-controls.test.tsx tests/release-remediation-controls.test.tsx tests/production-parity-controls.test.tsx tests/automatic-capture-controls.test.tsx tests/agent-access-controls.test.tsx tests/release-outcomes-controls.test.tsx tests/release-explanation-controls.test.tsx tests/workspace-notifications-ui.test.tsx tests/workspace-scan-policy-ui.test.tsx tests/workspace-team-ui.test.tsx tests/workspace-tokens-ui.test.tsx tests/workspace-evidence-settings-ui.test.tsx tests/workspace-exceptions-ui.test.tsx tests/deletion-request-ui.test.tsx tests/settings-install-interactions-ui.test.tsx tests/beui-select-ui.test.tsx tests/overview-activity-ui.test.tsx tests/watch-reduced-motion-ui.test.tsx
```

`npm run lint` exited0,29 warning lines. Warnings are not presented as a clean lint result. Logs: `/tmp/ns-gate-c-current-milestone.log`, `/tmp/ns-gate-c-current-lint.log`. Current build and live verification are in preceding batch entries.

## 2026-09-10 — Domain semantic palette

Overview and release-assurance semantic foreground/status colours now reference shared tokens; approved decorative shades remain. Build passed and rebuilt Overview screenshot/status colours reviewed. Behavioural evidence remains279/41 at8d4e658; no new behavioural suite claimed for CSS-only changes.

`npm run build` passed with existing chunk warning; diff check passed. Live Overview policy passed rgb(63,185,80), need review rgb(255,138,128). Screenshot shows retained panel gradients, hierarchy and counts. No functional/backend changes.

## 2026-09-10 — Expired coverage keyboard boundary

Expired Coverage/Setup overlay contents now use inert, matching the existing pointer lock for keyboard/AT access while preserving outside recovery actions. Two rendered expired/active cases pass (1.12s), build passes; real active Setup reviewed with zero inert descendants. Expired-state evidence is component-level, not a changed real trial. External checklist: GATE-C-MANUAL-VERIFICATION.md; checks remain unperformed.

Commands: `npx vitest run tests/coverage-expired-state-ui.test.tsx`, `npm run build`, diff check. Existing build chunk warning. Mock context tests assert inert boundary/recovery outside it and active restoration; jsdom is not native keyboard/AT execution. No account or API mutation.

## 2026-09-10 — Consolidated continuation authority

Replaced conflicting historical NEXT-SESSION-HANDOFF paragraphs with one current summary at88406f5. Original text retained in HANDOFF-HISTORY-2026-09-10.md, explicitly historical. Current handoff records completed real scan, exact cumulative versus focused evidence, preserved runtime and concrete remaining Gate C gaps. Documentation-only; diff check passed, no tests/build repeated.

## 2026-09-10 — Remaining expanded tool states

At6821f27 (runtime88406f5), real saved upload expanded gate policy, agent access, optional explanation, automatic capture and production comparison were reviewed. Controls stayed within actual390/768/1024/1440 CSS widths. Screenshots reviewed at390 for gate/agent/explanation/production, and1440 for agent access. Explanation provider disabled, no capture selector and missing adopted reference rendered truthful unavailable states. No fields changed or actions submitted; viewport restored. This does not verify enabled-provider/mapping forms or native zoom. No build/test repeated for this read-only browser review.

## 2026-09-10 — Isolated populated settings fixture

Added isolated actual-component QA fixture under tests/ui-fixtures, served locally on4351 without the application API plugin. Local fetch responses have no network fallback; mutations return405, server /api returns503, CSP restricts connections. Real4347 app untouched. Populated token/confirmation, read-only and error states screenshot-reviewed at390; audit screenshot-reviewed at390/1440. Token/audit geometry fits390/768/1024/1440. This is synthetic fixture visual evidence, explicitly not real credential or API lifecycle evidence. Fixture typecheck and production build passed; fixture marker strings absent from dist.

Commands: `npx tsc -p tests/ui-fixtures/tsconfig.json`, `npm run build`, `rg -l "ISOLATED UI FIXTURES|Fixture mutations are disabled|fixture_only" dist` (no matches), diff check. Initial fixture omitted utility source scanning; corrected with app-styles.css @source before accepting screenshots. Fixture server live exec86333, not the real server. No backend scan or account changes.

## 2026-09-10 — Remaining page-loading placeholders

Removed remaining visual fetch placeholders in ArtifactOverview (temporary heading/reading paragraph) and ReleaseAssurancePanel (temporary full card). Screen-reader-only loading statuses remain; real pending scan and errors retain visible content.29 cases/2 files passed (1.84s), then strengthened Overview pending assertion1/1 (21 skipped,1.13s). Final build passed; rebuilt live Overview screenshot reviewed. Delayed-response assertions prove hidden pending layout, not a captured live slow response.
Commands: `npx vitest run tests/artifact-overview-ui.test.tsx tests/release-assurance-history-mount.test.tsx`; targeted `-t "waits for the first workspace response"`; `npm run build`; diff check. Existing chunk warning. Hosted fixture extension investigation found these placeholders; that extension remains pending.

## 2026-09-10 — Hosted finding visual fixture and disclosure

HostedReleaseEvidence is now available in the isolated fixture with two findings and an exception form. Supporting assurance/history deliberately return unavailable; no mutation succeeds.390 and1440 screenshots reviewed, geometry fits390/768/1024/1440, selected finding updates URL and detail. WorkspaceExceptionRequest now exposes aria-expanded/aria-controls and names its form.3 hosted tests passed (1.31s), fixture typecheck and frontend build passed. This verifies the real component with fixture responses, not live hosted receipt/provider behaviour or the full hosted decision header.
Commands: `npx vitest run tests/hosted-release-evidence-ui.test.tsx`, `npx tsc -p tests/ui-fixtures/tsconfig.json`, `npm run build`, diff check. Existing bundle warning. No real app data changed; viewport restored.

## 2026-09-10 — Hosted brief incomplete assessment

Added full read-only WatchReleaseBrief fixture with incomplete assessment, blocked receipt and long package coordinate.390/1440 screenshots and390/768/1024/1440 geometry reviewed; Review release proof focused release-proof-artifact. Replaced misleading0-of-0 score with assessment unavailable when no applicable verified checks exist. Fixture typecheck/build/diff check passed; fixture markers absent from dist. No real hosted lifecycle, ready assessment or governance mutation is claimed. No behavioural suite repeated for this presentation-only correction. Commands: `npx tsc -p tests/ui-fixtures/tsconfig.json`, `npm run build`, production marker search and diff check. Existing chunk warning.

## 2026-09-10 — Canonical decision fixture variants

Hosted fixture now uses buildAssuranceView with existing test snapshots for ready, review and legal-hold blocked variants. All three fit390/768/1024/1440; ready/review390 screenshots and blocked1440 screenshot reviewed. No customer assessment generated. Found/fixed Receipt status incorrectly reflecting legal hold: it now derives solely from receiptStatus; release state remains Legal hold. One rendered regression passed (1.18s), fixture typecheck passed; final build passed after correcting explicit .ts import paths. No full suite repeated. Browser verified Receipt status Scan passed alongside release state Legal hold. Commands: `npx vitest run tests/watch-release-brief-ui.test.tsx`, fixture tsc, `npm run build`, diff check. Existing chunk warning.

### Configured-form visual review — 10 September
Added isolated actual-component production mapping and configured explanation/pending-review fixtures. All writes remain rejected locally; no provider or production setting was activated. In-app browser geometry at390/768/1024/1440 showed matching document width and zero clipped controls for both forms, with one mapping row and expanded aggregate disclosure. Screenshots inspected production at1280/390 and explanation at1440/390, including the mobile review editor. Fixture TypeScript check passed. This proves presentation only, not provider integration, native zoom or spoken screen-reader acceptance.

## Settings heading consistency
Team and Workspaces now consume WatchPageHeader instead of duplicating heading markup. Preserved page-specific member/invitation and workspace/create compositions. `npx vitest run tests/workspace-team-ui.test.tsx tests/workspace-management-ui.test.tsx`:20/20 passed,2 files,1.62s. `npm run build` passed (existing chunk warning); diff check passed. Real signed-in Team and Workspaces screenshots inspected after build, with shared heading rendering and working controls retained. No mutation or restart.

## Failure-label contrast audit
Calculated WCAG sRGB contrast for current Watch text tokens against panel111214, raised19191e and hover292930. Failure red e2453a gives4.59/4.29/3.54:1, insufficient for normal text on the latter surfaces. Overview failure verdict, QuietStatus failed, uploaded blocked-preview and critical-severity text now use existing danger-text ff9b99 (9.28/8.67/7.15:1). Accent/background red is unchanged. Other normal text tokens snow/mute/dim/review/warn/ok all exceed4.5 on these three backgrounds; info5b8def falls to4.47 on hover292930, so that combination is not approved for normal text. Build passed; diff check passed. Rebuilt real saved release reviewed, but its current policy-passed record has no affected failure-label instances; this is calculated CSS evidence, not live failed-state visual acceptance or whole-app WCAG certification. No behavioural suite repeated for colour-only change.

## Scan and Alerts responsive closure
At8fb4e7a, real signed-in Scan and selected Alert22 were checked at actual390/768/1024/1440 CSS pixels. Document width matched each viewport; inspected8 Scan and7 Alerts main controls, zero clipped controls. Scan screenshot reviewed at390; selected alert screenshots reviewed at390/1440, including long repository title wrapping and mobile Back to inbox. Back to inbox then Resolved displayed the genuine empty queue at390, with screenshot reviewed. No scan submitted or alert changed; viewport restored. This closes the listed Scan compact and Alerts selected/empty layout checks, not native zoom or spoken AT. No runtime edits or repeated build/tests for this read-only evidence.

## Gate scope audit
Read C1–C5 definitions and mockup contract against current handoff. Identified unaccounted C4/C5 scope, explicitly recorded as unverified and requested owner clarification. No runtime change or repeated tests. This corrects the acceptance boundary, not gate completion.

## 15 September — scan entry and return-path fixes

The owner clarified that customer journeys remain unfinished, not merely visual polish. The first bounded batch fixes Scan prerequisites and navigation; it does not close Gate C or the full funnel.

Real local trial is now expired. Scan previously led through repository controls before revealing the restriction; its plain links also reloaded Watch. Proof verification mode leaked through Overview back into New scan. Scan now shows an early permission/coverage explanation with scoped saved-release/coverage/settings links; unusable picker controls are omitted, website continuation waits for valid permissions, and existing proof verification remains available. GitHub copy distinguishes queued checks from completed evidence and monitoring. Ordinary local links use client navigation with modified-click semantics retained. Scan mode and source configuration intent stop following unrelated pages.

Verification on the batch based on440785f:
- `npx vitest run tests/scan-prerequisites-ui.test.tsx tests/scan-submission-navigation-ui.test.tsx tests/github-repository-scan.test.tsx tests/github-repository-scan-scope.test.tsx`:40/40,4 files,2.78s. First run found duplicate viewer messaging; redundant blocked connector was removed without weakening the old assertion.
- `npx vitest run tests/watch-desk.test.ts tests/artifact-shell-navigation.test.tsx`:42/42,2 files,1.27s. These are two focused runs, not a repeated full suite.
- `npm run build` passed including TypeScript; existing chunk-size warning. Affected-file oxlint exited0 with3 existing ScanPage warnings; `git diff --check` passed. Existing unrelated src/index.css and mock edits were preserved, excluded from the commit, and present during the local build.
- Real signed-in browser: expired Scan -> saved Releases -> existing full release brief -> proof verification remained navigable. Rebuilt Scan banner -> saved Releases stayed in the app shell. Verify proof -> Overview -> New scan now returns to default GitHub mode with workspace/install retained. No new scan, payment, evidence mutation, provider activation or production deployment.
- Desktop and390px Scan screenshots inspected; mobile document width390 and prerequisite bounds25–365. This is not all-width or native zoom/AT acceptance. Local screenshots: output/journey-2026-09-15/01-scan-before.png,02-releases.png,03-scan-after.png,04-scan-mobile.png.

Remaining concrete work: real active-coverage source setup/latest-release scanning and error recovery; broader finding-to-action usability; final design/accessibility consistency; establish which commit nospoilers-coral.vercel.app serves before hosted review. The old immutable Vercel deployment inspected12 September is not proof of that alias's version. Local organisation billing displays not configured; no renewal or trial extension performed. Do not repeat the already-proven artifact upload merely to fill UI evidence.

## 15 September — Radix dropdown batch

Installed @radix-ui/react-select2.3.7 and @radix-ui/react-dropdown-menu2.1.24 with package-lock updated. Shared Select now delegates focus, keyboard/typeahead, disabled options and portalled collision handling to Radix. Dedicated dropdown.css supplies charcoal surfaces,6px corners,36px rows, restrained open/close animation and CSS reduced-motion overrides. Workspace menu retains avatars and the plus/create row. Current Workspaces organisation/connection/destination and billing plan/interval fields plus uploaded-release status use the shared control; existing Team/Notifications/Overview consumers receive it too. Other native domain forms remain unchanged; this is not all-app dropdown completion.

Verification:61 distinct cases across9 focused files passed after2 harness corrections (first run59/61 in5.22s, affected workspace-management/reduced-motion rerun12/12 in1.51s). Files: beui-select-ui, workspace-management-ui, workspace-team-ui, workspace-notifications-ui, overview-activity-ui, uploaded-releases-ui, watch-reduced-motion-ui, organization-billing-ui, workspace-connection-placement-ui (all tests/*.test.tsx). Keyboard selection/disabled/typeahead/Escape focus, consumer mutations, connection rejection and scoped filter navigation are covered. Test helper now .tsx to use the existing DOM TypeScript project; two initial npm run build attempts stopped on helper type errors. Final npm run typecheck passed; npx vite build passed (existing chunk warning). Focused oxlint on changed runtime/shared tests and git diff --check exited0. No full suite repeated. npm install emitted the existing jsdom29 Node22.12 engine warning; no engine/dependency upgrade beyond Radix was attempted.

Real signed-in browser: desktop workspace and organisation popups inspected;390px organisation popup left45/right375.22 fits viewport. Mobile workspace menu in existing Headless dialog retained arrow focus and Escape return without closing the sidebar. Desktop release status selection filtered actual saved records to the one failed attempt with workspace/install preserved. No workspace change, scan, payment or evidence mutation. Browser reloaded built assets; server/database/signing state preserved. CSS reduced-motion is source verification, not OS preference or spoken AT verification. Pre-existing src/index.css and mockup changes remain excluded from this batch.

Remaining customer blocker: local trial expired and Stripe unconfigured. Reviewed existing Stripe configuration contract requires secret/webhook keys and Solo/Team monthly/yearly price IDs; no provider configured, trial extended or payment activated. Owner was offered local Stripe test-payment verification or read-only hosted billing inspection next; no answer yet. Gate C and wider journey remain open.

## 15 September — task-based settings composition

Based on 01fdd43. Owner requested proper styling and tabs to reduce overwhelming pages. Added @radix-ui/react-tabs and shared SettingsTabs: manual keyboard activation, force-mounted drafts with native hidden inactive panels, quiet underline navigation and active-tab horizontal reveal on resize without moving the page. Policy now has Scan rules, Exceptions, Signing and GitHub allowlist; connected subpanels no longer duplicate the page heading. Exception query deep links still select their panel. Notification destinations, delivery history and GitHub are separated; Add destination opens a focused editor, Cancel returns focus, and empty history has no dead pagination. Workspaces, creation, connections and organisation administration are separate; organisation Access, Activity, Billing and Deletion review have their own tabs. Shared Radix selectors and compact rows replace nested visual clutter. Authority, API behavior, confirmations, scope caveats and billing protections are preserved.

Browser review caught the sidebar Create workspace link dropping workspace scope and the selected Organisation tab clipping after a narrow resize. Both are fixed: creation retains workspace/install while clearing unrelated query intent, workspaceTab is removed on other routes, and selected tabs reveal within their own scroll container. Empty exception pagination and dashed invitation empty-state chrome were also removed.

Independent focused verification (overlapping runs, not a combined full-suite count):
- `npx vitest run tests/workspace-scan-policy-ui.test.tsx tests/workspace-exceptions-ui.test.tsx tests/workspace-management-ui.test.tsx tests/organization-access-ui.test.tsx tests/organization-billing-ui.test.tsx tests/workspace-notifications-ui.test.tsx tests/deletion-request-ui.test.tsx`: 46/46, seven files, 4.55s.
- After Cancel focus assertion: `npx vitest run tests/workspace-notifications-ui.test.tsx`: 9/9, 1.74s.
- After scoped creation and pagination fixes: `npx vitest run tests/workspace-management-ui.test.tsx tests/watch-desk.test.ts tests/workspace-exceptions-ui.test.tsx`: 62/62, three files, 2.05s.
- After selected-tab reveal regression: `npx vitest run tests/workspace-scan-policy-ui.test.tsx tests/workspace-management-ui.test.tsx tests/workspace-notifications-ui.test.tsx`: 27/27, three files, 2.59s.
- `npm run build` passed; final ResizeObserver compatibility fallback followed by `npx vite build` and `npm run typecheck`, both passed. Final asset index-DUa-REgO.js / WatchWorkspace-_6RRlWWe.js. Existing chunk-size warning remains. Focused runtime oxlint exited 0 with two existing WorkspaceExceptions effect-state warnings. `git diff --check` passed. No full suite repeated. Existing unrelated src/index.css/mock edits remained present during build and excluded from this commit.

Real signed-in Codex browser: inspected original hosted Policy and rebuilt local Policy, Notifications and Workspaces. Desktop screenshots reviewed; at 390px Notification history/editor, GitHub allowlist and organisation Billing controls fit (allowlist bounds 25–365; billing right edge 349; document width 390). Selected Organisation tab after final rebuild measured left289.56/right364.66 and was visibly readable. Final scoped sidebar creation click retained workspace/install and opened Create workspace in the existing shell. Viewport restored. No policy, workspace, role, destination, payment, scan or evidence mutation. Server/database/signing/GitHub connection preserved; frontend reload only.

Hosted coral rendered index-n1QmDyGn.js, a different bundle from local; deployed commit remains unverified. This batch is not deployed and does not claim all-app styling, native 200% zoom, audible screen-reader, production readiness or Gate C completion. Local trial remains expired and billing unconfigured. Remaining active-coverage setup/scan/recovery and broader page/state consistency work stays open.

## 15 September — settings design-engineering regression fixes

Based on cdcdfd9. A bounded review of the recent settings and shared dropdown changes reproduced and corrected:
- Radix Value discards className/style; the intended ellipsis class never reached the DOM. An owned span now applies truncation with min-width:0/flex:1, preserving the full accessible label.
- Workspace refresh failure while its menu was open left the portal active and the error/retry hidden from accessibility. Controlled open state now closes on failure and returns focus to Retry. Exception/exceptionBefore query intent is cleared outside Policy.
- Unrelated workspace rename/archive success cleared a hidden creation draft. Mutation-specific resets preserve it. Removed organisations require a new selection, pending fields are locked, failed reads clear stale controls without claiming the records are empty.
- Organisation access/billing scope changes could retain old controls and permit late response side effects. Keyed scope, revision-bound reads and aborted/ignored late actions prevent stale owner/deletion controls, old role-save callbacks and checkout redirects after leaving scope. Denied role changes invalidate cached authority; billing retry withholds old payment controls.
- Failed policy reload retained edit controls. Reload invalidates immediately. Incomplete exception list/detail responses previously crashed the panel; validation now shows recoverable errors. Review caught that PostgreSQL BIGSERIAL IDs are returned as strings; validation accepts bounded decimal strings without converting away precision, plus safe integer numbers. Local pg int8 parser behavior and raw-row adapter inspected.
- An allowlist response arriving after changing installations could clear the new draft or refresh the old installation. The scoped request is aborted and late success/error/finally ignored; current-scope success behavior remains.
- Notification polling could keep a removed destination's typed disconnect confirmation and restore private drafts after management access disappeared. Fresh results invalidate confirmation and clear drafts on lost authority; disconnect opens at its confirmation field and Cancel returns focus. Configuration choices which cannot display a form are disabled with prerequisite copy; buttons use pressed group semantics rather than an incomplete tab pattern.

Initial focused regressions reproduced Select, workspace-menu, stale-policy/malformed-exception, notification and allowlist failures before fixes. Independent role agents owned non-overlapping files; root reviewed integration and corrected BIGSERIAL compatibility. One final combined current-source run:
`npx vitest run tests/beui-select-ui.test.tsx tests/settings-tabs-ui.test.tsx tests/workspace-switcher-refresh-ui.test.tsx tests/watch-desk.test.ts tests/workspace-scan-policy-ui.test.tsx tests/workspace-exceptions-ui.test.tsx tests/policy-install-lifecycle-ui.test.tsx tests/workspace-management-ui.test.tsx tests/organization-access-ui.test.tsx tests/organization-billing-ui.test.tsx tests/workspace-notifications-ui.test.tsx tests/notifications-configuration-ui.test.tsx`
passed **117/117,12 files,6.56s**. `npm run build` passed (TypeScript + Vite; existing >500kB warning), producing index-DCyUfvEL.js and WatchWorkspace-DWvDyNnj.js. Focused runtime oxlint exited0 with only the two existing WorkspaceExceptions effect-state warnings; newly introduced effect warnings were removed. `git diff --check` passed. No full suite or API build repeated for this frontend-only batch.

Real signed-in browser: rebuilt workspace creation reviewed at desktop and390x844; selected organisation trigger measured302x36, textOverflow ellipsis class present and document width390. Screenshot showed the label contained, popup opened, Escape returned focus to its trigger. A temporary review tab was closed and viewport reset to avoid disturbing the owner's active Scan tab. No customer setting, role, payment, scan or evidence mutation; no server restart. Failure/race/authority transitions above are injected component tests, not changed real permissions or a live payment proof.

The build includes preserved pre-existing src/index.css changes excluded from this commit, plus existing mockup edits remain untouched. Hosted Vercel is unchanged. This is a verified bug-fix batch, not proof of zero bugs, all-page design completion or Gate C acceptance. Remaining active-coverage funnel, wider state/visual consistency and external native zoom/spoken AT checks remain in the current matrix.

## 15 September — alert queue spacing and owner-authorized local trial

Owner requested that alert queue controls move left and have more room between buttons, plus another trial for the current local workspace. Toolbar horizontal padding changed from32px to16px on desktop,16px to12px on compact screens. Buttons now have8px gaps/14px side padding on desktop and6px/10px compact; height40px. Selected-label nested backgrounds removed while the count badge retains a subtle fill. No queue filtering or mutation behavior changed.

`npm run build` (TypeScript + Vite) and `git diff --check` passed; existing chunk warning remains. Real signed-in browser desktop gaps measured8px, each button40px high. ArrowRight selected In progress and displayed its two real records; clicking Open restored22. At390x844, tablist bounds17–315.73, gap6px, document width390; both desktop and mobile screenshots reviewed. Viewport reset. No new tests/full-suite repeated for CSS/markup-only changes.

Local trial reset was explicitly requested by the owner, superseding the earlier instruction to leave it expired for the investigation. Stopped only the4347 app, confirmed no listener, then copied the embedded database to `/private/tmp/nospoilers-before-trial-20260915-stopped`. The earlier copy without `-stopped` was taken while the process was still live and is not the recovery backup. A transaction changed exactly the existing personal trial owner's trial_ends_at, scoped through workspace ccd3c6b7-1349-4b3b-1bfb-95298f23cd7e and its organisation; plan stayed trial. Previous expiry2026-09-14T07:40:26.996Z; new expiry2026-09-20T10:07:21.780Z. No billing-account row matched this personal scope; no Stripe/subscription/provider configuration changed. No quota reset, receipt rewrite or synthetic workspace introduced.

Restarted using the existing ignored `data/nospoilers-local-start.mjs` and unchanged database/signing/GitHub configuration. Sandbox initially denied process termination/listen; authorized elevated execution succeeded. Listener confirmed on127.0.0.1:4347; real authenticated UI shows Trial · 5 days left. This is a local owner-requested development reset, not payment-provider or production-renewal evidence. The hosted Vercel subscription remains untouched. Existing unrelated CSS/mockup edits preserved and excluded from commit; code build still includes existing dirty CSS.


## 15 September — concise alert queue copy

Missing-release queue rows now display the repository and “No published release”, removing repeated scan_latest_release identifiers and the redundant exposure/Saved check label. Other rows preserve their title and a useful nonduplicate coordinate; full findings/exposure remain in detail. Incomplete-check detail uses “Latest release check” with the original code in its title attribute; Where uses the repository from the original no-release title when the legacy record omitted full_name. Stored records and response behavior are unchanged.

`npx vitest run tests/alert-queue-keyboard.test.tsx tests/alert-filters-keyboard.test.tsx`:4/4,2 files,1.06s. New assertion initially exposed concatenated accessible row text; explicit punctuated row names corrected it. `npm run build` and `git diff --check` passed (existing chunk warning). Real signed-in rebuilt Alerts screenshot reviewed: first card reads EmotiveImpact/SaaS-Marketplace / No published release and detail names the repository. No server restart or data mutation; trial remains owner-reset state. Existing dirty CSS/mockups preserved.

## 15 September 2026 — visible Scan connection action (base54b6a49)

Owner requested removing the hidden Connect another GitHub source disclosure. Scan now presents the existing connection action directly in its secondary column (stacked below the repository task on mobile), with concise approval context. Replaced the repeated three-step guide with a short results section, removed duplicate artifact guidance and an empty action spacer. Existing connection scope, permissions, submission and evidence semantics remain unchanged.

Validation: `npx vitest run tests/scan-prerequisites-ui.test.tsx tests/github-connection-ui.test.tsx tests/github-repository-scan.test.tsx tests/github-repository-scan-scope.test.tsx`:24/24 passed,4 files,2.25s. Final `npm run build` passed after the empty-spacer cleanup (existing chunk warning); `git diff --check` passed. Real signed-in Scan reviewed at desktop and390px; mobile document width390, connection button x42/width126.42, zero GitHub-panel details disclosures, screenshot inspected. Keyboard Tab from connection button reached saved releases. No connection or scan submitted. Viewport restored; local server and database preserved. Build includes existing unrelated dirty CSS; only intended source/docs staged. No full-suite repeat, deployment or Gate C completion.

## 19 September 2026 — stable Coverage and coherent control surfaces

Coverage now holds its page heading while saved-source, disconnected-source and monitoring requests are pending. The loading state remains available to assistive technology but no longer briefly renders a stack of unrelated messages or an empty monitoring card before the real source state arrives. Failed reads retain their existing recovery behavior.

The shared sidebar footer now aligns with navigation rows and groups account actions under the existing account control: Workspace settings and Sign out are available from its upward-opening menu. Selected sidebar icons return to the neutral text treatment. Search, the search palette, shared Radix Select triggers/content and the account menu now use the canvas-black control surface, with a restrained raised state only for hover/open/selected rows.

Focused verification: `npx vitest run tests/source-monitoring-ui.test.tsx tests/disconnected-repositories-ui.test.tsx tests/coverage-detail-ui.test.tsx tests/artifact-shell-navigation.test.tsx tests/workspace-alerts-ui.test.tsx` passed **22/22** across five files. `npm run typecheck` and `git diff --check` passed. The preceding frontend build passed before this CSS-only control-surface adjustment; a new Vite build was not run because the local disk has only 395 MiB free and Vite fails while creating its temporary config file with `ENOSPC`. The separate read-only mockup server is restored on127.0.0.1:4350 using Python's static server; the signed-in app server/database/GitHub connection were not restarted or altered. No scan, alert, setting, billing or evidence record changed.


## 19 September 2026 — review of real Scan and Coverage implementation

Corrected the preceding UI increment: the independent Coverage workspace now imports its styles and supplies the parent selector those styles require. Kept the approved four scan selection cards and changing detail panel, added a visible primary scan action after local file selection, cleared an invalid replacement so an older file cannot be submitted accidentally, and kept scan permission checks. Coverage prerequisites now use a contained notice with aligned actions; the website input action no longer inherits the generic top margin. Simplified package instructions to describe the actual confirmation flow.

Verified 39 tests across scan-submission-navigation-ui, scan-prerequisites-ui, receipt-input-ui, workspace-coverage-empty and workspace-coverage-health-ui. TypeScript and Vite production build passed (existing chunk-size advisory). The local port 4347 process serves compiled dist, so rebuilding was necessary for these changes to appear. Rebuilt and inspected actual Coverage and Scan pages in the existing browser. The displayed workspace has ended coverage; no entitlement was changed and no live scan was submitted. Local build includes pre-existing dirty shared CSS. This is focused UI verification, not full integration, deployment or Gate C acceptance.

## 19 September 2026 — actual product audit and version 40 corrections

The local product now keeps the overview composition for empty as well as populated workspaces, derives the posture colour from real evidence, uses consistent neutral charcoal panels and amber review labels, and preserves the approved scan selection cards. Corrected a release finding grid that reserved a hidden badge column and squeezed titles into 62px; browser DOM measurements now give titles approximately 194px within the same 246px row. Independent-workspace activity now opens release history rather than the unsupported Timeline route. Website totals describe saved records instead of claiming disconnected records are configured monitoring.

Built source working tree on top of f85fae1, including the pre-existing shared index.css changes. TypeScript/Vite build passed (large chunk advisory), lint exited 0 with warnings, and 65 focused tests across overview/activity/coverage/release/scan passed. Browser checks opened the existing saved release, Findings/Files/Proof, Coverage, scan cards, alert queues, billing and search navigation; no console errors were reported. Current local billing is unconfigured and coverage ended: no live scan, payment, provider activation or deployment was performed. Screenshots from this browser have incomplete compositor regions; visual acceptance is not inferred from those captures. Audit notes are in output/product-audit-2026-09-19/README.md. CLI subprocess checks failed under restricted execution but all 30 receipt/setup tests passed with normal subprocess access. Full-suite result follows separately.

Full regression completed with normal subprocess access: `npx vitest run` passed **1,553 tests across 258 files** in 275.71 seconds. Two non-failing tar locale messages were emitted. `git diff --check` passed. Lint exited 0 with 31 warnings. These results validate the current working tree, not a deployed release or external worker/payment acceptance.

## 19 September — release History visual correction

Removed the duplicate visible Release tools heading and old nested assurance/history card frames in actual release detail. Supporting review uses compact typography, a neutral delivery row, aligned smaller actions, and quiet dividers; release intelligence inherits the same control and typography scale. Preserved review, export, stream, comparison and policy semantics. Browser inspected rebuilt History tab. Twenty release collection/detail/history-mount tests passed, production build passed with existing chunk advisory, and diff check passed. This is a styling correction, not new integration acceptance.

## 19 September 2026 — Mock 43 implemented in the actual release workspace

Owner approved `43-complete-release-workspace.html` for implementation. Uploaded and connected release detail now share a real-data decision hero, four independent evidence states, and Findings / Files / History / Proof. Neutral charcoal panels, compact typography, red active underlines and a wider finding column replace the overlapping older compositions. Single-category findings no longer repeat a second tab bar; mixed/deep-linked categories remain filterable. File inspectors show retained size/hash metadata, with uploaded-file navigation back to matching findings. MAP001/002/003 rebuild guidance follows the actual scanner rule mapping.

History groups comparison, release decisions, finding reviews, stream settings and access/assistance when a stream exists. No-stream and failed discovery states keep their real prerequisites and recovery behavior. Current-record file comparison stays distinct from selected history. Existing delivery/attestation/governance/hold controls remain available independently of history discovery. Saved evidence review opens the complete existing reviewer in an accessible dialog, retaining strict preview, limitations, refresh and export. Portal mounting and receipt-verification routing were corrected during testing. No capability is enabled by this UI change.

Proof separates the signed scan record/private passport from the public summary. Passport downloads re-fetch and validate scoped evidence. Public publish/replace/revoke uses explicit review dialogs; failed reads invalidate stale controls and record changes abort/ignore stale responses. Archived-workspace link revocation remains available to authorized owners/admins even when publishing is unavailable. No public summary, permission, source, billing or provider was changed during browser verification.

Source is the uncommitted working tree over `f85fae1` on `codex/release-assurance-spine-v1`, including preserved earlier UI work and shared CSS. This is local implementation, not a pushed PR, hosted deployment or production-readiness claim. Final validation results follow below.

Final stable-source verification: `npm test` passed **1,575/1,575 tests across259 files** in291.83s (22:03:09 local start). Two non-failing tar locale messages. The earlier restricted run was stopped because CLI/local-server tests require normal subprocess access; the final complete run used that access. Earlier transitional failures from concurrent source/test edits were resolved before this stable run. `npm run build` passed (TypeScript + Vite; existing >500kB chunk advisory), `npm run build:api` passed, `npm run lint` exited0 with32 warnings including the scoped ProofSharing refresh effect, and `git diff --check` passed. Final WatchWorkspace bundle: `WatchWorkspace-BfIXaRvK.js`. Scoped source hashes are in `output/release43-validation/SOURCE-SHA256.txt`.

The real upload page was rebuilt/reloaded and all four sections inspected. Files→metadata→matching finding navigation, saved-review content/focus restoration and public-preview Cancel were verified without mutations. Browser error log was empty. Connected review state and unavailable-history fallback retained release controls in isolated QA. Temporary4351 QA server/tab closed; real4347 app and4350 mock server preserved, viewport reset and actual release tab left open. See design-qa.md for responsive measurements and compositor limitations. No worker deployment, active-coverage scan, billing or provider acceptance is inferred; Gate C remains partial.

## 19 September — conditional states and quiet hover correction

Owner rejected evidence-status buttons with repetitive dialog navigation. Uploaded and connected release summaries now render four informational groups, preserving state colour, labels and accessible explanations without extra click targets or modal detours. The actual Findings/Files/History/Proof tabs remain the navigation. Removed hover-only background fills from sidebar/account rows, overview rows, Coverage, release/finding lists, settings tables, policy exception rows and scan selection/drop areas. Explicit selections, drag-over feedback, keyboard focus and compact button feedback remain.

Audited data-driven scenarios: overview quiet/review/running/empty/exposure uses saved data; finding category filters remain conditional on mixed categories or a selected category deep link; unknown/mismatched/preview assessments cannot substitute a pass; production evidence is independent of artifact status. Added six rendered production-state cases (passed, failed, review, stale, unknown, not-configured). Existing tests cover canonical ready/review/blocked/unknown, stale finding links, empty/running reports, history scope and failure handling. This is not a declaration that every operational/provider scenario is verified.

Final focused command: `npx vitest run tests/uploaded-release-brief-ui.test.tsx tests/watch-release-brief-ui.test.tsx tests/release-brief.test.ts tests/artifact-overview-ui.test.tsx tests/hosted-release-evidence-ui.test.tsx tests/release-assurance-history-mount.test.tsx tests/release-intelligence-panel.test.tsx` passed93/93 across7files in4.49s. `npm run build` passed (TypeScript+Vite; existing chunk advisory), `npm run lint` exited0 with warnings, diff check passed. Browser actual saved upload confirmed four status groups with zero buttons/links, correct independent labels, no duplicate category bar for its maps-only findings, and loaded sidebar hover rule background transparent. Screenshot inspected with the existing clipped compositor limitation. Built bundle WatchWorkspace-DfoHIJBC.js. No data mutation, deployment, provider activation or full-suite repeat; prior full-suite result applies to the preceding increment.

## 19 September — one uploaded-release detail action

Removed redundant View evidence action column from uploaded release/attempt rows. Build name still selects its preview; the single Open full release brief action now sits directly under the preview title. At the compact breakpoint the uploaded table retains build/result columns, with date/file count available in the preview; table no longer inherits640px minimum width. Connected release navigation is unchanged.

20 tests across uploaded-releases-ui and workspace-release-collection-ui passed in1.86s, including selecting another record and opening its scoped detail via the single action. TypeScript/Vite build passed (existing chunk advisory), diff check passed. Actual rebuilt browser confirms four-column desktop list, no View evidence row button and one primary action under selected title. Requested390px browser override did not apply (actual1422px); compact CSS reviewed but a live390px measurement is not claimed. Override reset and temporary test tab closed. No deployment/data changes or full-suite repeat. Bundle WatchWorkspace-DEwakpT7.js.


## 19 September 2026 — settings hierarchy and customer recovery pass

Owner asked for actual-product UI/UX fixes after the Organisation screen exposed three navigation levels and a large expandable administration panel. On the working tree over f85fae1, Settings now has a separate local navigation column on wide screens and a scrolling route row on compact screens. Page headings describe the selected Workspace section; the repeated settings kicker is suppressed. Organisation uses a visible identity/roles view, with Activity and owner-only Deletion review in focused accessible dialogs. Billing navigation no longer nests another settings tab group. Existing role, deletion, cancellation and stale-response guards remain.

Administration and billing show one organisation, defaulted from the current workspace. An inaccessible current organisation never silently falls back to another owned organisation's billing; the alternative must be selected explicitly. Workspace creation uses the current organisation by default while preserving an explicit draft choice. New workspace is discoverable in the page header. Current subscription/expiry, Solo and Team, monthly/yearly prices, checkout and portal controls use the actual billing API. Prices and entitlements are unchanged; provider-disabled state is explicit. Top See plans and Scan's ended-coverage recovery now lead directly to scoped Plan & billing. Changed release selections clear stale releaseFinding state; same-release selections retain it.

Coverage's website area now spans the full available width below GitHub setup. Ownership verification has labelled DNS type/name/value and an HTTP alternative, wrapping long values and aligning verification/lifecycle controls at compact widths. Verification and scan handlers, scope, disabled states, scheduling and typed disconnect confirmation are unchanged. Removed mock-style scenario narration from the uploaded release preview in favour of a concise independent-production-evidence explanation.

Focused checks: 73 tests across workspace-management, settings-tabs, journey-settings-shell, watch-desk and artifact-shell-navigation; 18 across organisation access/billing; final 35 across scan prerequisites, uploaded releases, websites, Coverage empty and Coverage health. All passed. TypeScript/Vite build passed; final bundle WatchWorkspace-CF-3PPMN.js (existing large-chunk advisory). API build passed. Lint exits0 with warnings; diff check passes. Full regression result is recorded separately below. Source hashes and logs: output/market-ui-validation-2026-09-19/.

Browser: actual signed-in Organisation, Activity open/close/focus return, billing recovery, Notifications, Scan policy, Team, Coverage, Scan prerequisite, Alerts queue selection and Releases collection inspected. New review tab preserved rather than reloading the user's separate settings tab with an unsaved deletion-review checkbox. No permission, payment, source, scan or public evidence mutation. At compact override390, actual CSS width433 (existing browser zoom): document width433; organisation/action right bounds413.33px and website controls/verification within388.23px. Fixed an action-row width+margin overflow caught during review. Normal viewport restored. Captures have the existing right/bottom compositor clipping, so whole-frame pixel-perfect, native200% zoom and spoken AT acceptance are not claimed. Browser error log was empty for the final review tab.

This is local implementation, not a deployment or a declaration that every app/provider scenario is complete. This host's billing is unconfigured and coverage ended. Hosted Railway worker, real hosted sign-in→scan→saved-result acceptance and payment/webhook entitlement verification remain required before launch.

Full regression completed: `npm test -- --maxWorkers=2` passed **1,595/1,595 tests across260 files** in388.00s (23:41:30 local start). Two non-failing tar locale messages. The restricted attempt was stopped after known CLI/local-server permission failures; the successful complete run used normal subprocess/localhost access. This run began after the settings changes; the final35-test batch separately passed after the last Coverage/scan/release-preview adjustments. Final TypeScript/Vite build includes those adjustments. Final lint exits0 with32 warnings; `git diff --check` passes. No hosted or production acceptance is inferred.


## 19 September — tablet/mobile sidebar correction
The mobile navigation Dialog is portalled outside .watch-desk and was missing the desktop rail rules. Shared the rail/theme/workspace-switcher rules with its explicit watch-navigation-dialog scope. The logo now has a dedicated brand row and stable140x38 sizing with top/side spacing; the old generic header-div selector no longer offsets the workspace picker. Added44px close control, touch targets, safe-area padding, min-height0 navigation scrolling and nonshrinking account/billing/help footer. Help navigation closes the drawer. Resizing into the desktop breakpoint closes the hidden dialog so it cannot retain modal focus. Neutral icons and no row hover-fill remain.

Final TypeScript/Vite build passed (WatchWorkspace-LPbG3xWm.js; existing chunk advisory). Eleven tests across artifact-shell-navigation and journey-settings-shell passed in2.07s, covering explicit close, Help close and desktop resize dismissal. Scoped lint0errors/two existing static-component warnings; diff check passed. Actual browser checked tablet853x1000 and phone433x666 CSS viewport (host zoom maps requested768x900/390x600): logo x19.98/y15,width140,height38; mobile rail width320, footer within viewport, phone nav scrollHeight383 inside306.79px. Account menu exposes sign out without mutation; Escape returns, desktop resize removes dialog, collapsed desktop rail remains60px. Original expanded state and normal viewport restored. Existing screenshot compositor clipping remains. No full-suite repeat or deployment for this bounded sidebar change.


## 20 September 2026 — local trial reset and launch-flow hardening

Owner authorised resetting the current local trial and completing the app/functional review. The current database is `data/nospoilers`, not the older local-start helper's database. With the app stopped and a separate backup retained, changed only the existing personal trial expiry to2026-09-24T23:33:21.394Z (25September00:33BST). Browser confirms five days. No Stripe subscription, prices, quotas, account or workspace ownership changed; no recovery clone replaced current data.

Actual browser upload through the local worker: acceptance-exposed-1.0.0.zip saved as c5dfdf05-31cd-4e72-a443-978d7f86b131,3files/3source-map findings/blocked; acceptance-fixed-1.0.1.zip saved as fe0cfe1b-de4a-44a8-a75e-32a0714927b1,2files/0findings/passed. Original and corrected records remain independent. Receipt JSON downloaded and verified authentic; pairing the original receipt with the corrected archive correctly reports a different artifact. Records survived graceful restart. The existing local-review login is not a fresh hosted OAuth acceptance; input archives are clearly named QA inputs scanned by the real runtime, not fabricated results.

Fixed authoritative scan workspace scope and staged claims, uploaded-release retry destination, small-file sizes, stale settings responses/authority/secrets, malformed API responses and audit export cancellation. Stripe entitlements now follow configured current subscription prices rather than stale plan metadata, handle prorated plan changes and fail closed for unknown/conflicting prices. Checkout/portal returns preserve authorised organisation/workspace context; returning from checkout does not imply payment confirmation. No price changed.

Corrected serverless boundary: web-role request-tail work cannot claim heavy scanner jobs. Added graceful SIGINT/SIGTERM draining and database close, idempotent runtime shutdown and non-overlapping poll ticks. Existing production scanner container requirements remain. Focused tests cover real isolated-database worker-process SIGTERM/reopen, injected OAuth-to-workspace/session flow, Stripe transitions, scoped billing returns and late-response settings cases.

TypeScript/frontend and API builds pass; final frontend WatchWorkspace-CHd6QDPT.js, existing large-chunk advisory. Lint exits0 with33warnings. Final full regression follows below. Evidence and700-file source manifest: output/launch-acceptance-2026-09-20/LOCAL-ACCEPTANCE.md and SOURCE-SHA256.txt. Working tree remains over f85fae1 with earlier UI work preserved; no push/deployment.

Actual rebuilt release/upload recovery/settings/billing and mobile drawer reviewed. At actual433CSSpx following390px override, billing document width433 and no overflowing controls; logo140x38 at20,15. Browser warning/error log empty; viewport restored. Existing compositor clipping and external native zoom/audible AT limitations remain.

Railway CLI is signed out and unlinked; owner project/service selection requested. The current worker requires an isolated executor; no Docker executable/daemon was found and the existing Railway RAILPACK config does not establish one. Local GitHub App, Stripe and Resend are unconfigured. Vercel project was identified read-only, but project detail hit a connector schema mismatch. Hosted sign-in→isolated worker scan→saved result, sandbox payment/webhook, notification delivery and operational acceptance remain open. No production-readiness declaration.

Remote PR check inspected20September: PR44 head36c35be8a7aab37f59ed5737c774ac442631e94d differs from the local working tree. CI run35464978393 did not start its test job: GitHub reports recent account payments failed or the spending limit needs increasing. This is an external Actions account blocker, not evidence that local tests failed or remote tests passed. No run was rerun or billing changed.

Final stable-source regression: `npm test -- --maxWorkers=2` passed **1,636/1,636 tests across267 files** in478.07s, start20September00:49:15BST. Two non-failing tar locale messages. Normal localhost/subprocess access was used. Final typecheck passed; final lint exited0 with33warnings; frontend/API builds passed before the last test-harness-only corrections. Source manifest rechecked unchanged after the full run. `git diff --check` passed. No source edits occurred during the successful run.
