# Watch lighthouse loading transition

Visual refinement: owner requested a smaller mark matching the app's icon family. The illustration is now a48px lighthouse drawn on a24-unit grid with consistent rounded strokes, matching the Lucide-style shell icons. Removed waves and decorative tower detail, reduced the beam footprint and glow, and tightened the label. Loading registration and reduced-motion behavior are unchanged.

Verification: two focused tests pass for waiting on all registered loading stages and cancelling the forward reveal when another blocking stage starts. Typecheck/diff pass. React guidance informed stable registration callbacks and effect cleanup. Browser visual review of the beam remains pending. No artificial scan progress, external services, dependencies or image assets were added.

Owner request: replace Loading Watch with a lighthouse whose beam starts to one side and turns toward the viewer when real loading completes.

Implementation contract: share loading state across lazy module, workspace resolution and authenticated loading; use a restrained red beam, soft forward glow and brief fade. Do not invent progress or delay requests. Reduced-motion preference gets a static lighthouse. Preserve accessible loading announcements and error handling.

Status: the initial file write failed while the disk reported 100% used (about132MB available), but a retry succeeded without deleting files. The lighthouse is now integrated with lazy-module, workspace resolution and session-loading signals. Its completion transition follows the loading registrations, not fake progress. Focused behavior verification is in progress; browser visual acceptance remains pending. Temporary-directory inspection found no large, clearly disposable task files; no files were deleted.

Gate B work immediately preceding this: migration115 and requestWorkspaceException support receipt-backed hosted findings. Existing independent and connected-upload regression tests and typecheck pass, but new hosted-request-specific tests and its UI are still required. Do not count this as completed hosted exception acceptance.
