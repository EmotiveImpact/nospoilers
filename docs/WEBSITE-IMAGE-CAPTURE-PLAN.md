# Website image capture plan

Status: capture instructions only. **No screenshots were generated, captured or embedded for this handoff.** Codex should use the finished application during local review, not historical mockups.

## Review setting and production behaviour

Start the existing Vite development server with `VITE_WEBSITE_CAPTURE_REVIEW=1`. The public React adapter also requires `import.meta.env.DEV`; a URL parameter or a production environment variable alone does not enable notes. The capture metadata module is dynamically imported only in this development branch.

In ordinary rendering every unfinished capture block returns an empty string: no internal notes, image elements, broken URLs or reserved blank space. Review mode inserts labelled, appropriately sized notes at the exact content locations below. Desktop reservations use a 16:10 frame; narrow layouts allow the instructions to reflow. After an approved image exists, add an explicit approved image content type and accessible caption/alternative text as a separate reviewed change. Do not replace the development guard with an always-visible placeholder.

## Global capture rules

Use only approved local QA data. Remove customer names/domains, real emails, credentials, cookies, API tokens, verification challenges, public-share tokens and sensitive paths/findings. Never fabricate an application state or alter evidence for a capture. Obtain owner approval before adding any final image.

Resolve `{qaWorkspace}`, `{qaAttempt}`, `{qaAlert}` and `{qaException}` through authorised local QA records. They are placeholders, not known customer IDs. If the required state is unavailable, leave the capture pending and record the gap instead of manufacturing it. Use supported, real UI actions and gain approval before any external/provider action.

## CAPTURE-WEB-PRODUCT-01

- Destination: `/product#inspect`
- Content location: `src/website/site-content.ts / product / inspect`
- Rendering component: `PublicContent` → shared `renderBlock` capture block; annotations supplied by `capture-review.ts`.
- Intended app route: `/watch/releases?workspace={qaWorkspace}&upload={qaAttempt}&uploadView=detail`
- Required state: A saved QA sourcemap fixture with real findings, correct digest and scope.
- Viewport: 1440 × 1000 CSS px.
- Framing: Full result header, verdict and first finding; retain enough app shell to establish context. No browser chrome.
- Caption: A saved release result keeps findings, scope and the recorded decision together.
- Demonstrates: The actual release evidence surface, not a new scan or a marketing mockup.
- Redaction: apply the global rules above, including any additional exclusions in the state/framing instructions.
- Status: awaiting finished-app local capture and owner approval.
## CAPTURE-DOCS-FIRST-SCAN-01

- Destination: `/docs/getting-started#scan-a-package`
- Content location: `src/website/docs-start.ts / getting-started / scan-a-package`
- Rendering component: `PublicContent` → shared `renderBlock` capture block; annotations supplied by `capture-review.ts`.
- Intended app route: `/watch/scan?workspace={qaWorkspace}&mode=package`
- Required state: Signed-in QA workspace with active test entitlement, package mode before upload.
- Viewport: 1440 × 900 CSS px.
- Framing: Launcher title, workspace context and upload controls; no fixture catalogue or developer tools.
- Caption: Choose the destination workspace before submitting the release archive.
- Demonstrates: The package entry action within the authenticated product shell.
- Redaction: apply the global rules above, including any additional exclusions in the state/framing instructions.
- Status: awaiting finished-app local capture and owner approval.

## CAPTURE-DOCS-WORKSPACE-01

- Destination: `/docs/workspaces-and-roles#ownership`
- Content location: `src/website/docs-start.ts / workspaces-and-roles / ownership`
- Rendering component: `PublicContent` → shared `renderBlock` capture block; annotations supplied by `capture-review.ts`.
- Intended app route: `/watch/team?workspace={qaWorkspace}`
- Required state: QA-only owner, administrator, member and viewer records from approved local fixtures.
- Viewport: 1440 × 1000 CSS px.
- Framing: Workspace name, role labels and membership list. Do not include invitation secrets.
- Caption: Workspace roles separate reading, response and administration.
- Demonstrates: Real role presentation without implying organisation billing authority or enterprise SSO.
- Redaction: apply the global rules above, including any additional exclusions in the state/framing instructions.
- Status: awaiting finished-app local capture and owner approval.

## CAPTURE-DOCS-GITHUB-01

- Destination: `/docs/github#connect`
- Content location: `src/website/docs-scan.ts / github / connect`
- Rendering component: `PublicContent` → shared `renderBlock` capture block; annotations supplied by `capture-review.ts`.
- Intended app route: `/watch/sources?workspace={qaWorkspace}&configure=github`
- Required state: Authorised QA workspace showing the real connection entry and any current configuration limitation. No live installation changes for an image.
- Viewport: 1440 × 900 CSS px.
- Framing: Connection heading, authority guidance and Connect action; omit any sensitive installation metadata.
- Caption: A GitHub connection requires explicit authority and installation approval.
- Demonstrates: Product workspace selection is distinct from GitHub source authorisation.
- Redaction: apply the global rules above, including any additional exclusions in the state/framing instructions.
- Status: awaiting finished-app local capture and owner approval.

## CAPTURE-DOCS-WEBSITE-01

- Destination: `/docs/website-scanning#ownership`
- Content location: `src/website/docs-scan.ts / website-scanning / ownership`
- Rendering component: `PublicContent` → shared `renderBlock` capture block; annotations supplied by `capture-review.ts`.
- Intended app route: `/watch/sources?workspace={qaWorkspace}&configure=website`
- Required state: QA-only unverified origin, actual challenge instructions and verification actions. Use a controlled test origin, not a customer domain.
- Viewport: 1440 × 1000 CSS px.
- Framing: Origin scope, DNS and HTTP instructions and verification buttons; redact the challenge value.
- Caption: Prove control of the exact hostname before starting a website check.
- Demonstrates: Ownership verification is a separate step, not a completed scan.
- Redaction: apply the global rules above, including any additional exclusions in the state/framing instructions.
- Status: awaiting finished-app local capture and owner approval.

## CAPTURE-DOCS-COVERAGE-01

- Destination: `/docs/coverage-and-releases#read-coverage`
- Content location: `src/website/docs-review.ts / coverage-and-releases / read-coverage`
- Rendering component: `PublicContent` → shared `renderBlock` capture block; annotations supplied by `capture-review.ts`.
- Intended app route: `/watch/sources?workspace={qaWorkspace}`
- Required state: Approved QA sources with a saved result and a delayed or unknown cadence state; actual backend state, not DOM edits.
- Viewport: 1440 × 1000 CSS px.
- Framing: Inventory and one selected detail showing source, scope, last check and cadence. Keep status labels legible.
- Caption: Monitoring freshness and a saved release decision answer different questions.
- Demonstrates: An older passing result does not establish current monitoring health.
- Redaction: apply the global rules above, including any additional exclusions in the state/framing instructions.
- Status: awaiting finished-app local capture and owner approval.

## CAPTURE-DOCS-RELEASE-01

- Destination: `/docs/release-results#open-a-result`
- Content location: `src/website/docs-review.ts / release-results / open-a-result`
- Rendering component: `PublicContent` → shared `renderBlock` capture block; annotations supplied by `capture-review.ts`.
- Intended app route: `/watch/releases?workspace={qaWorkspace}&upload={qaAttempt}&uploadView=detail`
- Required state: Retained QA fixture result with exact attempt selected; real findings and private evidence.
- Viewport: 1440 × 1000 CSS px.
- Framing: Title, outcome, scope, engine/time provenance and first finding. No customer data.
- Caption: Open a specific saved attempt to read its scope, findings and outcome.
- Demonstrates: Stable release-detail evidence, distinct from list selection or a pending upload.
- Redaction: apply the global rules above, including any additional exclusions in the state/framing instructions.
- Status: awaiting finished-app local capture and owner approval.

## CAPTURE-DOCS-ALERTS-01

- Destination: `/docs/alerts#queues`
- Content location: `src/website/docs-review.ts / alerts / queues`
- Rendering component: `PublicContent` → shared `renderBlock` capture block; annotations supplied by `capture-review.ts`.
- Intended app route: `/watch/alerts?workspace={qaWorkspace}&tab=waiting&alert={qaAlert}`
- Required state: QA website alert acknowledged and assigned to a QA responder, with authentic retained response history.
- Viewport: 1440 × 1000 CSS px.
- Framing: Queue labels, independent assignment, selected alert and activity. No provider send required.
- Caption: Assignment and response history are separate from the original finding evidence.
- Demonstrates: A workflow action records who responded without rewriting a scan result.
- Redaction: apply the global rules above, including any additional exclusions in the state/framing instructions.
- Status: awaiting finished-app local capture and owner approval.

## CAPTURE-DOCS-EXCEPTION-01

- Destination: `/docs/policies-and-exceptions#request`
- Content location: `src/website/docs-review.ts / policies-and-exceptions / request`
- Rendering component: `PublicContent` → shared `renderBlock` capture block; annotations supplied by `capture-review.ts`.
- Intended app route: `/watch/policy?workspace={qaWorkspace}&exception={qaException}`
- Required state: QA-only pending saved-finding request with independent approval required and self-approval visibly unavailable.
- Viewport: 1440 × 1000 CSS px.
- Framing: Exact rule/path/scope, reason, expiry and approval restriction. Redact unnecessary account identifiers.
- Caption: A scoped exception can require approval by a different administrator.
- Demonstrates: Pending is not approved, and risk acceptance is not remediation.
- Redaction: apply the global rules above, including any additional exclusions in the state/framing instructions.
- Status: awaiting finished-app local capture and owner approval.

## CAPTURE-DOCS-PROOF-01

- Destination: `/docs/proof#private-and-shared`
- Content location: `src/website/docs-review.ts / proof / private-and-shared`
- Rendering component: `PublicContent` → shared `renderBlock` capture block; annotations supplied by `capture-review.ts`.
- Intended app route: `/watch/releases?workspace={qaWorkspace}&upload={qaAttempt}&uploadView=detail`
- Required state: Private QA result with sharing preview open, not published. No public link created just for a screenshot.
- Viewport: 1440 × 1000 CSS px.
- Framing: Private sharing explanation and redacted summary preview. Exclude opaque tokens and full signed record.
- Caption: Review the redacted summary before explicitly sharing it.
- Demonstrates: Private evidence and a public summary are different projections.
- Redaction: apply the global rules above, including any additional exclusions in the state/framing instructions.
- Status: awaiting finished-app local capture and owner approval.

## CAPTURE-DOCS-TOKEN-01

- Destination: `/docs/api-tokens-and-ci#create-token`
- Content location: `src/website/docs-manage.ts / api-tokens-and-ci / create-token`
- Rendering component: `PublicContent` → shared `renderBlock` capture block; annotations supplied by `capture-review.ts`.
- Intended app route: `/watch/tokens?workspace={qaWorkspace}`
- Required state: QA token metadata/history only, with any one-time secret reveal cleared. Never mint a customer token for an image.
- Viewport: 1440 × 900 CSS px.
- Framing: Token name, metadata and revoke action. Remove token values, hashes and unnecessary prefixes.
- Caption: Keep scan credentials private and revoke them from workspace settings.
- Demonstrates: Metadata remains visible while token secrets are not recoverable from the list.
- Redaction: apply the global rules above, including any additional exclusions in the state/framing instructions.
- Status: awaiting finished-app local capture and owner approval.

## CAPTURE-DOCS-NOTIFICATIONS-01

- Destination: `/docs/notifications#configure`
- Content location: `src/website/docs-manage.ts / notifications / configure`
- Rendering component: `PublicContent` → shared `renderBlock` capture block; annotations supplied by `capture-review.ts`.
- Intended app route: `/watch/notifications?workspace={qaWorkspace}`
- Required state: QA-only saved destination with truthful not-tested or provider-unavailable state; no external test message for capture.
- Viewport: 1440 × 1000 CSS px.
- Framing: Destination type, configuration guidance and explicit test/status controls. Redact mailbox, webhook and secrets.
- Caption: Saving a destination does not establish successful delivery.
- Demonstrates: Configuration, test admission and provider acceptance are separate states.
- Redaction: apply the global rules above, including any additional exclusions in the state/framing instructions.
- Status: awaiting finished-app local capture and owner approval.
