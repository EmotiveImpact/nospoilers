# Gate C shared-component inventory — 10 September 2026

Inspected at runtime checkpoint9879664 plus the shared-palette refactor in this batch. This maps C1 source boundaries; it is not C2/C3 acceptance.

| Required component | Source owner | Actual consumers / boundary |
| --- | --- | --- |
| Page heading | WatchPageHeader | Coverage, Releases, Timeline, Team, Workspaces, other workspace settings, health and registry screens; approved Overview keeps its composed hero |
| Source picker | EvidenceTypePicker, GithubRepositoryScan | ScanPage evidence-type keyboard tabs; scoped repository selection stays in GithubRepositoryScan |
| Status badge | QuietStatus | Overview saved-attempt summary; domain-specific release statuses retain their explanatory wording |
| Async state | WatchDataState | WatchSkeleton is screen-reader-only between pages; initial Watch lighthouse remains separate |
| Evidence table | design/EvidenceTable | Uploaded manifest and workspace audit; chart text-equivalent table remains independent |
| Decision panel | design/ReleaseDecisionPanel | UploadedReleaseBrief and WatchReleaseBrief |
| Side preview | design/QuietSidePreview | ArtifactOverview and WatchSourcesSummary; caller owns Dialog and record scope |
| Empty state | design/QuietComponents QuietEmptyState | Connected decisions and connected audit |
| Dialog | design/QuietModalSurface | Add coverage and plans; caller owns authority/actions/title |
| Settings tabs | design/SettingsTabs | Policy, Notifications, Workspaces and organisation administration; Radix manual activation, retained drafts, hidden inactive panels and local horizontal reveal |
| Settings row | design/QuietComponents QuietSettingRow | Independent workspace policy choices and explanatory IDs |

Shared design CSS now references existing Watch panel/line/text/muted/status tokens instead of repeating matching hex values across coverage, team, page layouts, settings, evidence tables and quiet primitives. The palette definitions remain scoped in app-system.css; global marketing styles are untouched. This is exact-value consolidation, not a colour redesign.

Source-level limits: domain CSS outside design/ still contains specialised colours and spacing; not all status/direct markup has been normalized. Do not infer universal token adoption from the shared-layer cleanup. C1 component extraction is evidenced above; full token consistency remains open. C2 native zoom and audible AT remain unperformed, and C3 detailed state/viewport parity remains tracked in GATE-C-CURRENT-MATRIX.md.
