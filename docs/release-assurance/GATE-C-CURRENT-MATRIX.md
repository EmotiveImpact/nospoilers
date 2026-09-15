# Gate C current evidence map

Scan journey batch15 September: early prerequisites, scoped recovery links, client navigation and stale-mode cleanup implemented.40 Scan/navigation cases plus42 route/shell cases pass in separate focused runs; build and signed-in desktop/mobile checks recorded in BUILD-LOG. Active scan admission remains blocked by the real expired trial; billing is unconfigured locally. Full customer-funnel and Gate C acceptance remain open.

Current continuation authority: NEXT-SESSION-HANDOFF.md (consolidated10 September). Earlier checkpoint entries below are chronological; they do not override the current handoff or later BUILD-LOG evidence. Gate C remains partial.

Expired Coverage/Setup overlay contents now use inert, matching the existing pointer lock for keyboard/AT access while preserving outside recovery actions. Two rendered expired/active cases pass (1.12s), build passes; real active Setup reviewed with zero inert descendants. Expired-state evidence is component-level, not a changed real trial. External checklist: GATE-C-MANUAL-VERIFICATION.md; checks remain unperformed.


Overview and release-assurance semantic foreground/status colours now reference shared tokens; approved decorative shades remain. Build passed and rebuilt Overview screenshot/status colours reviewed. Behavioural evidence remains279/41 at8d4e658; no new behavioural suite claimed for CSS-only changes.


Current-source UI milestone at8d4e658:279/279 tests across41 files passed (19.94s). This supersedes the earlier partial40-file result. Repository lint exited0 with29 warnings; final runtime build already passed for8d4e658. No runtime change in this evidence update. Reuse this milestone until further substantive changes. Gate C remains partial for final domain-style/state parity and external native zoom/audible AT.


Release-tool responsive fix: native selects with long options could exceed their grid labels despite document width matching the viewport. Labels now use minmax(0,1fr); text controls have min-width:0 and width:100%. Build passed. Expanded remediation review/rebuild controls measured zero clipped controls at actual390/768/1024/1440; compact and desktop screenshots reviewed. No mutation; native zoom remains separate.


Shared component inventory is now in GATE-C-COMPONENT-INVENTORY.md. Shared design styles use Watch palette tokens for matching values. Build and real settings/Overview computed-colour checks pass; domain-specific styles outside design/ still require consistency review. No whole-gate completion claim.


Remediation follow-up: review/rebuild prerequisites now include Add required note, which focuses the shared note field; note guidance is programmatically associated. Ten remediation controls cases passed (1.60s), frontend build passed, and real saved-release click focused/scrolled the note into view. No mutation. Remaining Gate C scope is unchanged.


Latest runtime follow-up: page scroll resets before paint (abaaac9; four navigation cases and live scrolled Overview→Timeline check). Token revocation now focuses confirmation, returns focus on cancel and conditionally focuses history after success. Seven token cases pass (1.28s), final build passes; live empty token page reviewed, populated revocation remains component-test evidence. Prior cumulative milestone remains historical; Gate C C2/C3 and final consistency review are still open.


Current runtime checkpoint:6d84d33; latest40-file milestone and two focused test corrections are recorded in BUILD-LOG. This is a continuation checklist, not a completed gate. Historical test totals are not a current all-green run.

## Gate scope clarification — 10 September

The source plan also defines **C4** (physical web/app separation and preview-domain auth/pending-intent verification) and **C5** (website completion). The saved continuation limits the current implementation pass to C1–C3, while the goal says remaining Gate C. Neither C4 nor C5 is proven complete by this matrix. An owner scope question is pending. Do not claim the whole Gate C complete or silently authorize deployment/domain changes. Existing architecture notes explicitly defer physical separation. Preserve the approved homepage until scope is resolved.

## Requirements

| Requirement | Current evidence | Still required |
| --- | --- | --- |
| C1 page heading, async state, status/action/panel | WatchPageHeader, WatchDataState, QuietComponents and app-system.css are used by live pages | Audit remaining direct markup against those primitives; do not substitute matching CSS for component reuse |
| C1 evidence table | EvidenceTable is used by uploaded manifest and workspace audit; 13 focused cases and real compact manifest reviewed | Inventory complete: all visible JSX tables use EvidenceTable; separate WatchExposureChart table is its screen-reader text equivalent. Preserve that semantic alternative. |
| C1 source picker, decision, preview, settings row, dialog | Existing domain components and Headless UI dialogs implement these behaviours | Settings rows now use QuietSettingRow; centred dialogs use QuietModalSurface; connected/uploaded decisions use ReleaseDecisionPanel. Side preview now uses QuietSidePreview in Overview and Coverage. EvidenceTypePicker now owns Scan mode selection; GithubRepositoryScan owns scoped repository selection. C1 extraction boundaries are identified; global token consistency and remaining direct-markup inventory still need final review. Domain authority remains in callers. |
| C2 responsive | Historical core-route matrix and recent compact Team, Coverage, Setup and manifest observations are in BUILD-LOG | Latest changed routes at remaining prescribed widths; native 200% zoom is not proven by viewport reflow |
| C2 keyboard/focus | Existing component checks; live search End visibility and Escape return | Finish live representative navigation/form/dialog checks for changed layouts |
| C2 errors/permissions | Named test files below cover rejection, retry and role boundaries | Do not label component-injected states as live provider behaviour; verify current layout of representative states |
| C2 contrast/reduced motion | Shared tokens, prior measured contrast, reduced-motion code paths | Current changed-control contrast audit and actual reduced-motion execution evidence |
| C2 assistive technology | Named regions, captions, column scopes, live regions and focus assertions | Audible screen-reader verification remains unperformed |
| C3 parity/packaging | Approved target is mockup30; galleries excluded by build packaging | Remaining detailed route/state visual review; preserve all working controls |

## Route evidence and next checks

| Family | Direct checks to reuse | Design evidence and remaining scope |
| --- | --- | --- |
| Overview | artifact-overview-ui, overview-activity-ui | Approved live reference; preserve composition |
| Coverage/detail | coverage-detail-ui; source-monitoring-ui covers mutation controls separately | Real summary/filter/rows reviewed; direct filtered-total regression added. No claim that mutation tests test layout |
| Setup | Actual signed-in optional cards and compact reflow | Direct setup-card semantic test coverage not established |
| Scan | scan-submission-navigation-ui | Connected picker now precedes extra connection setup; compact layout now checked at all four widths; picker keyboard End selection is recorded below |
| Alerts | watch-accessibility, workspace-alerts-rendered, alert-response-permissions-ui | Queue/tab styling and role semantics checked; selected detail now checked at all four widths and mobile resolved-empty queue reviewed; permission failures remain component evidence |
| Releases | uploaded-release-brief-ui, uploaded-releases-ui, hosted-release-evidence-ui | Real connected rows and uploaded manifest checked; hosted finding/exception detail now fixture-reviewed at390/1440 with all-width geometry; incomplete hosted decision header now fixture-reviewed; canonical ready/review/blocked variants now fixture-reviewed; configured production/explanation forms now fixture-reviewed; no provider lifecycle claim |
| History/tools | release-intelligence-panel; tool-specific rendered tests | Current/selected/stream scope groups reviewed. Default gate/agent forms and unavailable explanation/capture/production states now reviewed at390 and geometry-checked at all four widths; configured provider/mapping forms now fixture-reviewed below; external integration is separate |
| Team | workspace-team-ui | Members/invite composition reviewed desktop and compact; denied-write/read-only tests exist |
| Notifications | workspace-notifications-ui | Setup/history composition reviewed; test/rejection/duplicate protection covered without sending |
| Tokens | workspace-tokens-ui | Reveal/revoke/read-only/uncertain creation tests exist; populated/confirmation/read-only/error states now visually reviewed in isolated actual-component fixtures; real credential lifecycle not exercised |
| Audit/retention | workspace-evidence-settings-ui, deletion-request-ui | Shared named table and retained deletion boundaries; real connected audit is empty and its empty state was reviewed. Populated workspace audit now has isolated actual-component fixture screenshots at390/1440 and geometry at all four widths; remains fixture-only |
| Policy/exceptions | workspace-scan-policy-ui, workspace-exceptions-ui | Independent choices and expanded connected signing controls reviewed at390px without document overflow; direct exception form reviewed and improved at768px with shortcut focus verified; mutation confirmations remain component-test evidence |
| Health/registries | settings-install-interactions-ui, workspace-coverage-health-ui | Earlier compact/focus evidence preserved; no provider or credential writes authorised by design verification |

## Completion rule

Close only rows with matching authoritative evidence. Run a cumulative UI milestone after the remaining implementation batch, not after every row. External native zoom/speech limitations remain explicit; they do not justify inventing completion or rebuilding unrelated backend features.


Shared Select follow-up: removed undefined beUI foreground/background/border/muted token references and supplied real app colours, including explicit keyboard focus rings on selected and unselected options. Final build passed; signed-in ArrowDown visibly focused Email with an inset ring, Escape closed without selection. CSS-only correction reuses preceding eight behavioural cases; no new suite claimed. Other native form selects remain pending.


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


## Compact shared-control verification

At b4b45a2 runtime, signed-in Team member menu reviewed at actual355 CSS pixels with document width355. Requested390 viewport initially yielded355; adjusted tool viewport to429 and confirmed innerWidth390, innerHeight844. At actual390, Notifications open destination menu, connected decision filters/empty state, and Add coverage open modal were visually reviewed with document width390. All four modal source choices were visible; Escape dismissed, then normal viewport restored. No source/account mutation. This is CSS viewport evidence, not native200% zoom, and does not cover every state/width. No tests/build repeated for this read-only check.


## Dropdown widths and contrast

At c8a95bd, live open Team invitation and Notifications destination menus had exact document/viewport equality at768,1024,1440 CSS pixels. Team screenshot reviewed at768/1440; Notifications screenshot at768; other widths are geometry evidence. Closed menus and restored viewport. No writes. Defined dropdown contrasts (sRGB WCAG calculation): f4f4f5/111214=17.05:1; b1b1ba/191a1d=8.18:1; a1a1aa/191a1d=6.79:1; f4f4f5/303134=11.83:1; focus a1a1aa/303134=5.07:1 (selected background approximates 10% white over191a1d). These cover the new dropdown palette, not whole-app contrast. Native zoom, spoken AT and actual reduced-motion execution remain distinct gaps.


## Typography and reduced-motion component execution

Live app and approved mockup30 both report `Inter, -apple-system, system-ui, Segoe UI, sans-serif`, with document.fonts empty in each current browser document. Preserved this approved fallback rendering; no claim Inter is bundled/loaded. Added two rendered checks with Motion useReducedMotion explicitly returning true: search initially fully visible without transform and focused combobox/End selection, plus select keyboard selection/focus return. Both passed (1.30s), typecheck passed. These exercise the reduced-motion component branches; they do not emulate OS media preference or establish whole-app animation compliance. No runtime change or repeated build/scan.


## Expanded default and unavailable tool states

At6821f27 (runtime88406f5), real saved upload expanded gate policy, agent access, optional explanation, automatic capture and production comparison were reviewed. Controls stayed within actual390/768/1024/1440 CSS widths. Screenshots reviewed at390 for gate/agent/explanation/production, and1440 for agent access. Explanation provider disabled, no capture selector and missing adopted reference rendered truthful unavailable states. No fields changed or actions submitted; viewport restored. This does not verify enabled-provider/mapping forms or native zoom.


## Loading layout cleanup

Removed remaining visual fetch placeholders in ArtifactOverview (temporary heading/reading paragraph) and ReleaseAssurancePanel (temporary full card). Screen-reader-only loading statuses remain; real pending scan and errors retain visible content.29 cases/2 files passed (1.84s), then strengthened Overview pending assertion1/1 (21 skipped,1.13s). Final build passed; rebuilt live Overview screenshot reviewed. Delayed-response assertions prove hidden pending layout, not a captured live slow response.


## Hosted finding fixture

HostedReleaseEvidence is now available in the isolated fixture with two findings and an exception form. Supporting assurance/history deliberately return unavailable; no mutation succeeds.390 and1440 screenshots reviewed, geometry fits390/768/1024/1440, selected finding updates URL and detail. WorkspaceExceptionRequest now exposes aria-expanded/aria-controls and names its form.3 hosted tests passed (1.31s), fixture typecheck and frontend build passed. This verifies the real component with fixture responses, not live hosted receipt/provider behaviour or the full hosted decision header.


## Hosted incomplete header

Added full read-only WatchReleaseBrief fixture with incomplete assessment, blocked receipt and long package coordinate.390/1440 screenshots and390/768/1024/1440 geometry reviewed; Review release proof focused release-proof-artifact. Replaced misleading0-of-0 score with assessment unavailable when no applicable verified checks exist. Fixture typecheck/build/diff check passed; fixture markers absent from dist. No real hosted lifecycle, ready assessment or governance mutation is claimed.


## Canonical decision variants

Hosted fixture now uses buildAssuranceView with existing test snapshots for ready, review and legal-hold blocked variants. All three fit390/768/1024/1440; ready/review390 screenshots and blocked1440 screenshot reviewed. No customer assessment generated. Found/fixed Receipt status incorrectly reflecting legal hold: it now derives solely from receiptStatus; release state remains Legal hold. One rendered regression passed (1.18s), fixture typecheck passed; final build passed after correcting explicit .ts import paths. No full suite repeated.

### Configured-form visual review — 10 September
Added isolated actual-component production mapping and configured explanation/pending-review fixtures. All writes remain rejected locally; no provider or production setting was activated. In-app browser geometry at390/768/1024/1440 showed matching document width and zero clipped controls for both forms, with one mapping row and expanded aggregate disclosure. Screenshots inspected production at1280/390 and explanation at1440/390, including the mobile review editor. Fixture TypeScript check passed. This proves presentation only, not provider integration, native zoom or spoken screen-reader acceptance.

## Settings heading consistency
Team and Workspaces now consume WatchPageHeader instead of duplicating heading markup. Preserved page-specific member/invitation and workspace/create compositions. `npx vitest run tests/workspace-team-ui.test.tsx tests/workspace-management-ui.test.tsx`:20/20 passed,2 files,1.62s. `npm run build` passed (existing chunk warning); diff check passed. Real signed-in Team and Workspaces screenshots inspected after build, with shared heading rendering and working controls retained. No mutation or restart.

## Failure-label contrast audit
Calculated WCAG sRGB contrast for current Watch text tokens against panel111214, raised19191e and hover292930. Failure red e2453a gives4.59/4.29/3.54:1, insufficient for normal text on the latter surfaces. Overview failure verdict, QuietStatus failed, uploaded blocked-preview and critical-severity text now use existing danger-text ff9b99 (9.28/8.67/7.15:1). Accent/background red is unchanged. Other normal text tokens snow/mute/dim/review/warn/ok all exceed4.5 on these three backgrounds; info5b8def falls to4.47 on hover292930, so that combination is not approved for normal text. Build passed; diff check passed. Rebuilt real saved release reviewed, but its current policy-passed record has no affected failure-label instances; this is calculated CSS evidence, not live failed-state visual acceptance or whole-app WCAG certification. No behavioural suite repeated for colour-only change.

## Scan and Alerts responsive closure
At8fb4e7a, real signed-in Scan and selected Alert22 were checked at actual390/768/1024/1440 CSS pixels. Document width matched each viewport; inspected8 Scan and7 Alerts main controls, zero clipped controls. Scan screenshot reviewed at390; selected alert screenshots reviewed at390/1440, including long repository title wrapping and mobile Back to inbox. Back to inbox then Resolved displayed the genuine empty queue at390, with screenshot reviewed. No scan submitted or alert changed; viewport restored. This closes the listed Scan compact and Alerts selected/empty layout checks, not native zoom or spoken AT. No runtime edits or repeated build/tests for this read-only evidence.
