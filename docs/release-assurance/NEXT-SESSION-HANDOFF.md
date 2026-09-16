# Current NoSpoilers continuation — 15 September 2026

15 September engineering follow-up (base cdcdfd9): fixed shared Select truncation, failed workspace-menu refresh/focus, exception query leakage, stale policy/organisation/notification controls, lost creation drafts, scoped allowlist/role/billing late responses and dead-end notification choices. Combined 117/117 tests across12 files and final build passed; mobile Select and Escape focus verified in the signed-in browser. See latest BUILD-LOG for exact scope. No deployment or Gate C completion; preserved unrelated dirty CSS/mockups.

15 September dense settings batch: Policy, Notifications and Workspaces now use task-based Radix tabs, quiet rows and secondary disclosures. Organisation access/activity/billing/deletion review is separated. Drafts, exception deep links and workspace scope are preserved. Focused tests, typecheck/build and signed-in desktop/390px visual checks passed; exact evidence is in the latest BUILD-LOG. The hosted coral alias still serves a different frontend bundle; no deployment performed. Other pages, active-coverage funnel and Gate C remain open.

15 September Radix batch: shared Select and workspace menu migrated; Workspaces/billing/release-status fields connected.61 focused cases, final typecheck and Vite build pass; desktop/mobile browser checks recorded in latest BUILD-LOG. Other native domain dropdowns and billing/provider acceptance remain open. Preserve existing dirty CSS/mockups.


## Current customer-journey priority

Owner correction: the funnel and UI still need functional tightening; do not describe the remaining work as styling alone. First scan-entry/navigation batch is now implemented and verified (see latest BUILD-LOG). Start with the remaining concrete journey checks recorded there; reuse the82 passing focused cases and original saved scan proof.

Owner explicitly requested another local trial on15 September. The existing personal trial was reset to five days, ending2026-09-20T10:07:21.780Z (11:07 UK time); the real signed-in UI shows Trial · 5 days left. Only the exact local owner trial timestamp changed; this is an owner-authorized development reset, not a verified subscription-renewal flow. Organisation Stripe remains unconfigured; hosted billing is unchanged. Do not reset it again or activate billing without another owner request. Current hosted alias supplied by owner is https://nospoilers-coral.vercel.app; its deployed commit remains unverified. The earlier4 September immutable URL was not the current alias.

Local restart configuration was recovered12 September with the original GitHub key and derived signing values. Durable private launcher: `data/nospoilers-local-start.mjs` (ignored by git). Use `node --import tsx data/nospoilers-local-start.mjs` only when a listener is absent and local work requires the server; never print/commit its configuration. Server was restarted15 September for this review, preserving the database.

## Start here

Previously pushed base for the current scan-journey batch: `440785f`, pushed to `codex/release-assurance-spine-v1`; PR #44 remains draft. Inspect the actual worktree/head before writes. This handoff supersedes the conflicting older checkpoint paragraphs archived in HANDOFF-HISTORY-2026-09-10.md. Full chronological commands/results remain in BUILD-LOG.md.

The active scope is app-wide design and Gate C C1–C3, not another backend feature build. Use one agent unless bounded parallel work materially helps. Follow AGENTS.md and current owner constraints; do not repeat its historical first-scan task.

## Approved design and preserved runtime

- Reference: `public/mockup-review/2b/30-quiet-structure.html`, design gallery31 and the approved live Overview. Earlier mockups23/28 are historical directions.
- Preserve sidebar/logo/whole-sidebar hover behaviour and title/trial/search arrangement. Dark surfaces, restrained corners, fine dividers, semantic status colours and existing top glow remain approved.
- No visible inter-page loading placeholders. WatchSkeleton is screen-reader-only. Initial Watch lighthouse remains. Page scroll resets before paint; delayed focus does not reset scroll again. Overview and release assurance no longer mount temporary visible reading cards/headings during fetch; pending/error messages remain. Latest focused29-case evidence is in BUILD-LOG.
- Real signed-in app: `http://127.0.0.1:4347`, workspace `ccd3c6b7-1349-4b3b-1bfb-95298f23cd7e`, install `160267630`. Use its existing Codex in-app browser through computer use. Do not extract sessions/cookies or use a separate unauthenticated browser.
- Preserve server, `data/nospoilers-local-dev`, signing configuration and GitHub connection. Same-state restart is authorized if necessary. Private launcher: `/private/tmp/nospoilers-preserved-server-start-abs.mjs`; never print/commit its configuration. Historical exec IDs are not evidence of a currently live process. Frontend builds have been served without restart.
- Preserve dirty mockup31/index and untracked mockup/QA files. Stage only intended files. No merge, deploy, paid-provider activation, Docker, synthetic customer review or production-safeguard changes.

## Completed work to reuse

Page composition already includes Overview, Coverage/Setup cards and filters, Timeline, Scan picker, Alerts, release list/detail/tool grouping and workspace settings. Shared component consumers are mapped in GATE-C-COMPONENT-INVENTORY.md. Shared palette CSS and Overview/assurance semantic colours now use Watch tokens; domain-specific presentation still needs final consistency sign-off.

Recent focused fixes: token revocation confirmation/cancel/success focus; remediation Add required note links and descriptive association; expired Coverage/Setup covered content made inert; long release-tool select options constrained within grid tracks. Do not rebuild these.

Real scan-to-saved-evidence workflow is already verified: upload `6f7e4c8c-0bd1-48e8-84c2-b5f10487dcd6`,64 files/zero findings, recorded in NoSpoilers web build stream, remediation case `d44de9f3…` checked as verified_absent. Review/build linkage is human-declared. Original receipts/alerts unchanged; production is not verified. Do not repeat a scan to fill UI acceptance gaps.

## Verification to reuse

- Cumulative UI milestone at `8d4e658`:279/279 cases,41 files,19.94s. Exact command in BUILD-LOG. Includes search/reduced-motion branches, role/error states and current shared-control families.
- Subsequent runtime changes: semantic CSS consolidation plus expired Coverage/Setup inert boundary. The latter has2/2 focused rendered cases,1.12s. Do not call this a fresh281-case cumulative run.
- Final build after88406f5 source passed, with existing chunk-size warning. Repository lint at8d4e658 exited0 with29 warnings, not warning-free.
- Normal route width observations are historical and recorded in BUILD-LOG. Recent expanded review/rebuild controls have actual390/768/1024/1440 geometry evidence and390/1440 screenshots. Document width alone missed intrinsic-select clipping; measure control bounds too.
- Search End visibility/Escape return and scoped results were verified; reduced-motion component branches were tested with mocked Motion preference. This is not OS media emulation.
- Active Setup screenshot was reviewed; expired state is injected component evidence, not a changed real account.

- Further live tool review: gate/agent forms and unavailable explanation/capture/production states fit390/768/1024/1440.390 screenshots and1440 agent screenshot reviewed; enabled-provider/mapping states remain unverified. See latest BUILD-LOG.

- Isolated fixture page now verifies populated token/audit layout and token read-only/error states. See tests/ui-fixtures/README.md;4351 is QA only and has no customer API. Typecheck/build passed, fixture markers absent from dist.

- Hosted findings/exception detail now has isolated fixture review at390/1440 and all-width geometry; full decision-header/provider acceptance is distinct. Three focused tests/typecheck/build pass.

- Full hosted brief incomplete-assessment fixture reviewed at390/1440; all-width geometry and proof focus pass. Empty0-of-0 score now states assessment unavailable. Other canonical assessment variants are not implied.

- Canonical ready/review/blocked header variants now fixture-reviewed via the real assessment builder; all-width geometry passes. Receipt status is separated from legal hold, with one regression/build pass.

## Remaining Gate C work

Use GATE-C-CURRENT-MATRIX.md for route/state evidence and GATE-C-COMPONENT-INVENTORY.md for source boundaries. Do not treat every historical missing item as still unbuilt.

1. Configured production mapping and explanation/pending-review forms now have isolated visual evidence at all four widths; see latest BUILD-LOG. Any remaining state audit must use the current matrix rather than repeating these reviews. No real provider integration is implied.
2. Finish domain-style consistency review against mock30/live Overview, preserving functioning controls. Common component extraction is evidenced; universal palette/typography/spacing compliance is not automatically established by extraction.
3. Native200% zoom and audible screen-reader execution remain unperformed. GATE-C-MANUAL-VERIFICATION.md gives the exact external checklist. Viewport reflow and ARIA inspections do not close these. A user question about external verification is pending; lack of reply is not sign-off.
4. Build and inspect any actual changes, use focused tests, then update acceptance/matrix/log and the existing draft PR. Reuse the cumulative milestone unless further changes justify another.

Gate C and the active goal are not complete. Do not mark them complete or infer production readiness from this handoff.

## Settings heading consistency
Team and Workspaces now consume WatchPageHeader instead of duplicating heading markup. Preserved page-specific member/invitation and workspace/create compositions. `npx vitest run tests/workspace-team-ui.test.tsx tests/workspace-management-ui.test.tsx`:20/20 passed,2 files,1.62s. `npm run build` passed (existing chunk warning); diff check passed. Real signed-in Team and Workspaces screenshots inspected after build, with shared heading rendering and working controls retained. No mutation or restart.

## Failure-label contrast audit
Calculated WCAG sRGB contrast for current Watch text tokens against panel111214, raised19191e and hover292930. Failure red e2453a gives4.59/4.29/3.54:1, insufficient for normal text on the latter surfaces. Overview failure verdict, QuietStatus failed, uploaded blocked-preview and critical-severity text now use existing danger-text ff9b99 (9.28/8.67/7.15:1). Accent/background red is unchanged. Other normal text tokens snow/mute/dim/review/warn/ok all exceed4.5 on these three backgrounds; info5b8def falls to4.47 on hover292930, so that combination is not approved for normal text. Build passed; diff check passed. Rebuilt real saved release reviewed, but its current policy-passed record has no affected failure-label instances; this is calculated CSS evidence, not live failed-state visual acceptance or whole-app WCAG certification. No behavioural suite repeated for colour-only change.

## Scan and Alerts responsive closure
At8fb4e7a, real signed-in Scan and selected Alert22 were checked at actual390/768/1024/1440 CSS pixels. Document width matched each viewport; inspected8 Scan and7 Alerts main controls, zero clipped controls. Scan screenshot reviewed at390; selected alert screenshots reviewed at390/1440, including long repository title wrapping and mobile Back to inbox. Back to inbox then Resolved displayed the genuine empty queue at390, with screenshot reviewed. No scan submitted or alert changed; viewport restored. This closes the listed Scan compact and Alerts selected/empty layout checks, not native zoom or spoken AT. No runtime edits or repeated build/tests for this read-only evidence.

Scope audit: ENTERPRISE-READINESS-PLAN also contains C4/C5. Owner clarification is pending because this handoff says C1–C3 while the goal says remaining Gate C. Neither wider requirement is verified complete. See current matrix; do not silently expand into deployment or replace the approved homepage.

Alert queue copy follow-up: missing releases now show repository + No published release; repeated job codes and Saved check removed from rows. Detail retains evidence with readable Latest release check label. Four focused tests/build/live screenshot passed; see latest BUILD-LOG.

Scan disclosure follow-up: GitHub connection is now a visible secondary action, stacked on mobile, rather than a hidden details section. Repeated guide/copy and empty spacer removed.24 focused cases and final build passed; real desktop/390px reviewed with zero panel disclosures and no horizontal overflow. See latest BUILD-LOG. No connection/scan mutation or restart.

16 September owner requested complete journey designs/images then HTML before further app styling. Isolated prototype at public/mockup-review/2b/36-journey: gallery.html contains21 screen captures and live links; index.html#journey maps the process; index.html#welcome starts it. Three built-in ImageGen anchor concepts use approved mock30 screenshot as reference. Static preview on4350, no app/server4347 or hosted changes. All21 routes checked1440/390 CSSpx; core mock journey/search/viewer/error behavior reviewed. README/design-qa.md contain exact scope and limitations. Await owner's design feedback; these screens are proposals, not approved production replacement or Gate C completion. Preserve unrelated dirty files.
