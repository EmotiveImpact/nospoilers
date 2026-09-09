# Current NoSpoilers continuation — 10 September 2026

## Start here

Current implementation head: `88406f5`, pushed to `codex/release-assurance-spine-v1`; PR #44 remains draft. Inspect the actual worktree/head before writes. This handoff supersedes the conflicting older checkpoint paragraphs archived in HANDOFF-HISTORY-2026-09-10.md. Full chronological commands/results remain in BUILD-LOG.md.

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

## Remaining Gate C work

Use GATE-C-CURRENT-MATRIX.md for route/state evidence and GATE-C-COMPONENT-INVENTORY.md for source boundaries. Do not treat every historical missing item as still unbuilt.

1. Finish detailed state/visual review where the matrix lacks matching evidence: hosted decision-header parity beyond the fixture-reviewed finding/exception detail, enabled-provider/production-mapping forms beyond the reviewed default/unavailable controls, and any additional state gaps in the matrix. Populated token/audit states now have isolated actual-component visual evidence at tests/ui-fixtures (4351); this does not prove real API lifecycle. Existing injected tests prove behaviour only; no fake live data or unnecessary credential creation.
2. Finish domain-style consistency review against mock30/live Overview, preserving functioning controls. Common component extraction is evidenced; universal palette/typography/spacing compliance is not automatically established by extraction.
3. Native200% zoom and audible screen-reader execution remain unperformed. GATE-C-MANUAL-VERIFICATION.md gives the exact external checklist. Viewport reflow and ARIA inspections do not close these. A user question about external verification is pending; lack of reply is not sign-off.
4. Build and inspect any actual changes, use focused tests, then update acceptance/matrix/log and the existing draft PR. Reuse the cumulative milestone unless further changes justify another.

Gate C and the active goal are not complete. Do not mark them complete or infer production readiness from this handoff.
