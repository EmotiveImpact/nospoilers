# Gate C current evidence map

Current source checkpoint: 2158712 plus the direct Coverage rendering test documented in BUILD-LOG. This is a continuation checklist, not a completed gate. Historical test totals are not a current all-green run.

## Requirements

| Requirement | Current evidence | Still required |
| --- | --- | --- |
| C1 page heading, async state, status/action/panel | WatchPageHeader, WatchDataState, QuietComponents and app-system.css are used by live pages | Audit remaining direct markup against those primitives; do not substitute matching CSS for component reuse |
| C1 evidence table | EvidenceTable is used by uploaded manifest and workspace audit; 13 focused cases and real compact manifest reviewed | Other evidence tables must be inventoried before claiming universal reuse |
| C1 source picker, decision, preview, settings row, dialog | Existing domain components and Headless UI dialogs implement these behaviours | Identify shared composition boundaries and consolidate actual duplicates without weakening record/role semantics |
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
| Scan | scan-submission-navigation-ui | Connected picker now precedes extra connection setup; complete current compact/keyboard review |
| Alerts | watch-accessibility, workspace-alerts-rendered, alert-response-permissions-ui | Queue/tab styling and role semantics checked; remaining changed-state visual review |
| Releases | uploaded-release-brief-ui, uploaded-releases-ui, hosted-release-evidence-ui | Real connected rows and uploaded manifest checked; hosted detail and deeper form presentation require final review |
| History/tools | release-intelligence-panel; tool-specific rendered tests | Current/selected/stream scope groups reviewed. Expanded tool forms need final design review |
| Team | workspace-team-ui | Members/invite composition reviewed desktop and compact; denied-write/read-only tests exist |
| Notifications | workspace-notifications-ui | Setup/history composition reviewed; test/rejection/duplicate protection covered without sending |
| Tokens | workspace-tokens-ui | Reveal/revoke/read-only/uncertain creation tests exist; populated current visual state not live exercised |
| Audit/retention | workspace-evidence-settings-ui, deletion-request-ui | Shared named table and retained deletion boundaries; real connected audit is empty and its empty state was reviewed. Populated workspace audit remains fixture-only |
| Policy/exceptions | workspace-scan-policy-ui, workspace-exceptions-ui | Independent choices and expanded connected signing controls reviewed at390px without document overflow; direct exception form reviewed and improved at768px with shortcut focus verified; mutation confirmations remain component-test evidence |
| Health/registries | settings-install-interactions-ui, workspace-coverage-health-ui | Earlier compact/focus evidence preserved; no provider or credential writes authorised by design verification |

## Completion rule

Close only rows with matching authoritative evidence. Run a cumulative UI milestone after the remaining implementation batch, not after every row. External native zoom/speech limitations remain explicit; they do not justify inventing completion or rebuilding unrelated backend features.


Shared Select follow-up: removed undefined beUI foreground/background/border/muted token references and supplied real app colours, including explicit keyboard focus rings on selected and unselected options. Final build passed; signed-in ArrowDown visibly focused Email with an inset ring, Escape closed without selection. CSS-only correction reuses preceding eight behavioural cases; no new suite claimed. Other native form selects remain pending.


## Shared policy settings row

Extracted QuietSettingRow for the two independent policy choices, preserving presentation and save/permission boundaries. Each checkbox now references its explanatory text with aria-describedby. Four scan-policy cases passed (1.64s); final build/diff check passed. Actual signed-in page reviewed and both description references resolve to the correct existing explanations; no policy changed. This closes the concrete duplicate settings-row extraction, not universal C1 completion or screen-reader speech acceptance.


## Shared modal surface

QuietModalSurface now owns the identical backdrop, centred scroll container and panel used by Add coverage and plans dialogs. Existing Dialog owners/titles/actions remain intact. Build and diff check passed; real Add coverage rendering reviewed and Escape removed the dialog with focus returned to Add coverage. No source added or billing action. This is structural reuse with live dismissal evidence, not a fresh full interaction suite or full Gate C sign-off.
