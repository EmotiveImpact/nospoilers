# NoSpoilers website and product architecture

## Public surface separation — owner correction, 8 September

`/docs` and its articles are a standalone documentation workspace: compact header, persistent desktop navigation, mobile navigation dialog, searchable guides and card-based start page. App routing bypasses the marketing shell for these routes. Neither the marketing header/footer nor the supporting-page navigation belongs above documentation.

Product, Use cases, Integrations, Security, Enterprise and Support remain public website pages under the marketing shell—not documentation articles. Their presentation uses split heroes, conceptual release-flow diagrams and capability/section layouts, while preserving evidence-backed content and review-only image annotations. Pricing retains its real checkout handlers. The original homepage layout remains intact. The desktop marketing menus expose supporting destinations; supplementary page links sit below content rather than competing with the main header.

The route separation has an explicit rendered regression for docs home and article URLs. The website/docs focused suite passes29 tests across3 files; production build/typecheck passed before that test-only addition. Visual sign-off and fresh approved product captures remain separate from these technical checks.

## Current evidence — 8 September

**Gate B is complete:** the final requirement matrix is accepted; regression38375 passes986/198 and build27665 passes. No verification is pending. This supersedes the earlier in-progress verification paragraph below. Live hosting/provider/worker validation and physical folder extraction remain separately deferred, not claims made by product-flow acceptance.

The authoritative acceptance ledger is `GATE-B-COMPLETION-AUDIT.md`, with the bounded requirement mapping in `GATE-B-FINAL-EVIDENCE-MATRIX.md`. Combined regression 59716 passed 986 tests / 198 files. A later test-only assertion explicitly verifies staged-expiry rejection without new work or usage. Final verification 38375 includes that assertion and is running; older process references below are historical. Gate B remains open pending closure.

Direct uploads, opt-in development fixtures and post-login staged claims now send explicit workspace/connection scope. Claims are idempotent: replay reopens the original immutable attempt and does not move its workspace or charge again. The client distinguishes staging/submission from scan execution, rejects malformed acknowledgements, supports explicit claim retry and ignores submission callbacks after leaving the owning screen. Local fixtures remain unavailable in production. Public intake still does not expose scan results.

Website/package/repository publication now commits related source metadata, saved evidence and alert linkage atomically through dedicated publication helpers. Repository migration121 adds lifecycle generation fencing alongside existing source controls, so stale work cannot update a changed connection. Post-commit delivery cannot rewrite a recorded result. Real database rollback and stale-generation regressions cover these boundaries. Physical folder extraction, auth-provider activation, hosted worker validation and deployment remain separately deferred; no Docker is required for this local Gate B work.

## Historical evidence — 6 September, 06:06

Use `GATE-B-COMPLETION-AUDIT.md` for current acceptance status; the checkpoints below are chronological and their pending statements are not a current task list. Hosted evidence request UI, atomic policy snapshots and legacy direct-creation approval enforcement now exist. Full baseline797 passed before subsequent receipt/input and workspace-state corrections; the new full acceptance run45217 is still running. Website/product folder split, provider activation and deployment remain deferred. No Docker was introduced.

The receipt JSON verification API now distinguishes an unrecognized signature from a correctly signed proof paired with different bytes; public redacted links remain a separate projection. Verification does not start a scan. Live local direct-link inspection confirms the selected independent artifact brief retains its saved scope/findings/private-sharing state. This is not full Gate B acceptance.

Checkpoint115: shared exception requests accept a retained hosted receipt or an uploaded attempt, exclusively, deriving exact scope server-side. Focused tests verify approval affects future policy evaluation without rewriting the hosted report. Hosted UI integration remains pending. Watch loading now uses the owner-requested lighthouse with shared lazy/workspace/session loading registrations, reduced-motion CSS and a completion-triggered forward glow; two behavior tests and typecheck pass, visual acceptance pending. See WATCH-LIGHTHOUSE-PLAN.md. Disk was nearly full during work; retry succeeded and no files were deleted.

Hosted evidence checkpoint114: new hosted scan reports are stored as private, immutable receipt-linked evidence with workspace/connection checks. Receipt, evidence and revision persistence share a transaction. The authenticated release-evidence endpoint does not expose this report through public proof verification; missing historical reports are explicit, not reconstructed. Nine focused persistence/access/ledger/upload tests pass. Hosted evidence request UI is still pending, and full788 regression predates these changes.

Connected-upload approval checkpoint113: workspace exception requests now accept saved connected upload evidence, retaining installation ownership alongside workspace and digest. Shared request/review APIs and release-detail controls are reused. Hosted policy consumes exact matching approved requests; independent scans exclude them. Three focused backend/migration checks and typecheck pass. Non-upload hosted evidence, legacy direct allowlist unification and snapshot timing are not yet completed. No provider activation or deployment occurred.

Connected exception checkpoint112: legacy allowlist records have backfilled, immutable workspace ownership and protected evidence scope; new package-scoped entries must belong to the same connection. Existing revocation remains supported but cannot be reversed in place. Two migration/authority tests and typecheck pass. Legacy creation still uses the connected policy flow, not the independent approval workflow; unified approval/review remains unfinished. The earlier full788 suite predates112.

Verification update (6 September): full run42836 passed 788 tests / 173 files, and build97812 passed. The exception suite is no longer pending. These results cover the policy checkpoint below, not subsequent edits or full Gate B acceptance. Independent policy page and empty-state browser evidence are confirmed; populated and mixed-workspace rendered journeys still require acceptance.

Policy checkpoint (111, 6 September): both workspace shells expose independent artifact/website policy and exception review. Connected workspaces retain separately labeled GitHub policy controls. Policy selection is per scan: installation-null attempts capture workspace policy, installation-backed attempts continue through the connected policy engine. A real mixed-workspace worker test proves those settings do not leak across scan types. Three policy tests, six preceding UI/policy checks and typecheck/diff pass. Exception requests preserve exact evidence scope, require approval, enforce independent approval when configured, and never rewrite old results or resolve alerts. Full exception regression is pending; legacy exception migration and remaining Gate B acceptance are not closed. See GATE-B-WORKSPACE-EXCEPTIONS.md.

Notification checkpoint (109): independent website alert publication now transactionally queues workspace-owned notification jobs, drained by the existing runtime worker. Slack/email transport uses encrypted destination values, current workspace/payer checks, configuration-version checks, delayed retries and immutable sanitized delivery history. Explicit authenticated test admission is audited, rate-limited and idempotent, without fake alerts or scans. Shared Notifications UI is reachable in both shells; connected legacy controls remain accessible separately. Local browser verifies the real empty screen and unconfigured email warning without creating destinations. Build32813/typecheck/diff and five latest focused checks pass; existing504.59kB main bundle warning remains. This does not close B8: mixed-source routing parity, populated/mobile acceptance, concurrency/uncertain-send hardening and a fresh full regression remain open. Details: GATE-B-WORKSPACE-CREDENTIALS.md. No provider activation, deployment or Docker occurred.

Credential checkpoint (104): workspace-owned scan tokens support independent and connected workspaces through one UI and authenticated workspace management APIs. Existing v1 scan/status endpoints accept independent bearer credentials, preserve immutable workspace ownership and use its payer; no GitHub installation is fabricated. Token mint/revoke events are transactional; legacy and workspace tokens share capacity. Production build65292 passes (existing504.59kB main bundle warning). Real local-review browser renders the independent token route/navigation/empty state. Full regression757/153 passed before credential changes; subsequent focused checks pass, but a fresh complete regression and populated/mobile/permission-refresh acceptance remain required. Notification ownership migration and wider Gate B gaps remain open. No deployment, Docker or auth-provider activation occurred.

Workspace presentation checkpoint (101): workspace Alerts uses workspace-owned evidence and HTTP response APIs in independent and connected shells; legacy installation routes remain for old URLs. Workspace Overview now uses the shared ArtifactOverview component on both paths. The server separates upload attempts, de-duplicated hosted release records, exposure response and website health. Hosted groups include exact installation IDs for scoped history links. This is routing/data integration, not full visual/enterprise acceptance: connected job aggregation, all source health types, retention-state parity and remaining B0–B8 work are still open. No deployment/auth-provider activation is implied.

Current implementation checkpoint (100; supersedes historical checkpoints below): fresh GitHub connections use a signed, session-bound intent, pending verified webhook inbox and transactional workspace binding. Source membership is workspace-authoritative; jobs retain an independent billing payer. Repository disconnection preserves identity/evidence; alert assignment uses stable member IDs. Independent websites now have workspace ownership, DNS/HTTP verification, explicit queued checks, signed saved results, retained lifecycle events and opt-in 6-hour/daily scheduling through the existing worker poller. Schedule admission shares payer/usage limits, advances its due time atomically with enqueue, and rechecks source/member authority. Pausing blocks checks; disconnection disables the schedule; reconnect requires fresh verification. Coverage exposes those controls in independent workspaces. Overview identifies website vs artifact evidence. Mixed GitHub/website workspace UI, source-health/Alerts aggregation and remaining B0–B8 acceptance are still open. Physical app/web separation and auth-provider activation remain deferred. See `GATE-B-WEBSITE-CUTOVER.md`; this is not full Gate B completion or hosted deployment evidence.

Source refresh follow-up (still 089): installation upsert is transactional and skips legacy organisation/trial bootstrap when the source already belongs to a product workspace. Webhook metadata refresh therefore preserves the workspace payer instead of creating a duplicate account. Fresh unbound installation coordination remains pending.

Latest (089): internal connection intents now bind a single ten-minute request to session/user/workspace/organisation; consuming and binding share a database transaction with live authority checks. No public entry point is exposed until setup/webhook coordination is complete. GitHub repository inventory is available through a bounded paginated port, not yet a resync workflow. User installation access is not GitHub installation administration; new binding must establish the latter separately. See the newest Gate B tracker before enabling Connect. No visual/shell changes in this checkpoint.

Latest (088): source-ID billing management/status requests resolve their workspace organisation and then require organisation billing authority. Raw canonical account reads deliberately do not re-resolve an account alias as a source. Jobs now reference source installations separately from immutable billing payers, permitting an additional source without an additional subscription record. Historical orphan aliases remain intact; the new source FK checks new writes without retroactively validating those aliases. Fresh GitHub connection intent/webhook/resync coordination is still pending. Older billing-routing pending notes below are superseded, not the remaining connection workflow.

Source entitlement reads and hosted scan charging now use the mapped workspace organisation via source-billing.ts. The source identifier remains evidence/operation identity; the resolved payer is persisted on its job. An expired mapped organisation cannot borrow the installation's old trial. Source-aware billing management/Stripe status routing and fresh connection registration still need cutover before cross-organisation attachment is exposed; tests of mappings are isolated fixtures, not permission to move customer sources.

Migration 087 separates durable job billing ownership from source identity. New independent artifact jobs have no source installation but retain their organisation/personal payer in immutable job columns. Retry/refund/concurrency code uses those columns, not the submitting member or current source mapping. This prerequisite does not yet enable fresh GitHub attachment into another workspace; remaining source entitlement and setup/webhook paths must be migrated before that control is exposed.

Current Gate B boundary: independent artifact workspaces render real Overview, Releases, embedded Scan, Team, Scan policy, Retention and Audit inside the product shell. Their sidebar/palette omit unavailable connection-only controls. Uploaded proof sharing is an explicit redacted public API, separate from private receipt downloads and authenticated results. Source read authority now derives from workspace membership; fresh source attachment still requires the source/billing alias migration and webhook coordination. Do not treat current legacy installation ownership as the final organisation model. Migrations through 086; see GATE-B-IMPLEMENTATION.md for verification and remaining work.

Approved lifecycle update: DATA-LIFECYCLE-POLICY.md now governs disconnect/retention/deletion. Disconnect retains history; permanent deletion and closure-related history loss require explicit separate authorisation. Earlier pending-policy notes below are superseded; deletion execution remains unfinished.

Last confirmed: 5 September 2026

Current local continuation through `080`: personal organisation billing no longer needs a fabricated GitHub installation; it preserves the existing shared trial/usage account. Explicit **unused-only** same-organisation connection placement is guarded and audited, and GitHub login cannot add destination access afterward. This does not yet bind fresh OAuth installations before sync or migrate populated source resources. Physical folder separation remains deferred; no deployment occurred.

Latest continuation (`077_connection_disconnect`): one workspace can expose multiple mapped connections without duplicate workspace rows or cross-workspace selector fallback. Installation-backed billing now has immutable organisation ownership and survives source disconnection; billing mutations require organisation administration. Source disconnect locally retains evidence, stops work and revokes scan tokens. **Retention policy confirmation is pending** because old public copy promised tenant deletion; do not deploy this lifecycle until reconciled. Independent source attachment and full billing/resource/worker migration remain unfinished.

Latest B0 continuation: `075_organization_ownership` separates organisation administration from workspace/source roles. Workspaces exposes authenticated administration controls with last-owner protection. Artifact-workspace invitations share the existing billing allowance without granting legacy source access. Durable billing storage is still installation/user-keyed; connection reassignment and worker/resource cutover remain open. See `GATE-B-IMPLEMENTATION.md` for verification; no hosted migration or physical folder split is implied.

Current continuation adds `074_workspace_membership`, real workspace team/invitation APIs and UI, and canonical workspace resolution for legacy entry/upload links. The connection resource/authorization and billing cutover is still open. Membership migration is not proof that every legacy source API is workspace-first; use `GATE-B-IMPLEMENTATION.md` for current test and browser evidence.

Gate B workspace checkpoint: the owner explicitly included migration now, while leaving the auth provider undecided. Additive migrations `071_workspace_foundation`, `072_workspace_management` and `073_workspace_upload_ownership` are implemented. Workspace management/switcher and workspace-owned artifact uploads are integrated; additional workspaces reuse the existing billing usage account. Connection ownership, independent membership and remaining resource/worker authorization cutover are still open; the physical web/app split remains deferred. See `GATE-B-IMPLEMENTATION.md` for tested evidence and remaining work. No hosted migration or domain changes have been performed.

## Decision

Owner update, 5 September 2026: no local Docker. Hosted worker deployment and isolation verification are deferred; assess Railway later. A separate worker remains the architectural boundary, but its execution mechanism is not fixed to Docker. Current production code still requires container mode and must be adapted and verified before live customer scans. Proceed with Gate B locally.

Implementation checkpoint: `/watch/scan` queues authenticated artifact uploads and navigates to `/watch/releases?upload=<id>`. `/scan` remains public staging only; its authenticated claim uses POST. Browser and CI artifacts now share the queued worker path, and installation completions use the release ledger. Personal uploads remain user-scoped. The CI API now returns 202 and requires polling. A dedicated container-capable worker must be validated separately from the web deployment. See `GATE-A-IMPLEMENTATION.md` for exact contracts and open release checks. No domain deployment has been performed; the physical app split remains pending.

Build sequencing and launch gates: `docs/ENTERPRISE-READINESS-PLAN.md`. Security evidence: `docs/SECURITY-READINESS-REVIEW.md`. UI/API parity: `docs/MOCKUP-PRODUCTION-CONTRACT.md`. Read these alongside `PRODUCT-DIRECTION.md`; the physical folder migration remains pending.

Keep one Git repository, but make the public website and authenticated product independent applications in a monorepo.

- `nospoilers.com` — marketing, pricing, docs, trust, public proof verification, and the pre-auth scan intake.
- `app.nospoilers.com` — login, onboarding, New Scan, Coverage, Releases, Alerts, Settings, and all customer evidence.
- `api.nospoilers.com` — optional explicit API host for auth callbacks, scan orchestration, webhooks, and verification APIs.

Separate repositories would make shared types, evidence components, brand tokens, and coordinated releases harder without buying useful isolation. One monorepo can still produce independently deployed website, product, API, and worker services.

## Target layout

Tenant architecture is governed by `IDENTITY-WORKSPACES.md`: product identities and billing workspaces are independent of connected GitHub installations. The current installation-backed model requires an explicit migration; folder separation does not implement this boundary.

```text
apps/
  web/       public website and acquisition scan intake
  app/       authenticated customer product
  api/       HTTP API, auth callbacks, webhooks, billing endpoints
  worker/    queued scan and monitoring jobs
packages/
  ui/        shared NoSpoilers primitives and visual tokens
  contracts/ shared schemas, API types, and event definitions
  scanner/   scan orchestration shared by API and worker
  config/    TypeScript, lint, test, and build configuration
```

## Route contract implemented now

- `/scan` is the anonymous website doorway. It may collect a URL or upload intent, but it must not expose findings or run an unclaimed free scan.
- `/watch/scan` is the signed-in product launcher. GitHub, package/build, production website, and release-proof paths all live in the product shell.
- Signed-in visitors who reach `/scan` are forwarded to `/watch/scan`.
- The post-login pending-scan handoff resolves to `/watch/scan?reveal=1`.
- New Scan remains a global action, not another inventory item in the sidebar.

## Safe cross-domain handoff

Keep the product browser's API same-origin using routing to the API service. An independent API deployment does not require a third browser-facing origin. The domain names here are target examples, not evidence that DNS or deployment has been configured.

The future website must pass only a short-lived opaque intent identifier to the app. The intent belongs to the browser session, is claimed after authentication, expires quickly, and is exchanged server-side. Upload contents, URLs, findings, and customer identity must not be serialized into a cross-domain query string. Production-website scans require an ownership check before detailed evidence is revealed.

## Migration sequence

1. Stabilize the logical boundary in the current app: public shell on `/scan`; product shell on `/watch/scan`. **Done.**
2. Unify browser, pending, CI and monitored scans into an installation/workspace-scoped queued pipeline with shared entitlement, usage, policy and durable release persistence; finish destination states without moving files.
3. Extract shared UI tokens, schemas, and evidence components into packages.
4. Move public routes to `apps/web` and product routes to `apps/app` as a behavior-preserving change.
5. Configure independent preview and production deployments with path-based build filters.
6. Move authentication callbacks and pending-scan claiming to the app domain, then verify cookie, CSRF, CORS, and redirect allowlists.
7. Cut over DNS only after end-to-end tests pass on preview domains.

Do not perform the physical folder move in the middle of the current product redesign. That would combine visual, routing, authentication, import, and deployment changes into one risky migration. The route contract above lets the product be completed against the right boundary first.

## Production boundaries to preserve during extraction

- Exclude prototype/QA pages from customer deployments; use a separate review origin without customer cookies.
- Customer artifact parsing executes in bounded workers with limited credentials, filesystem and network access.
- Tenant authorization remains server-side even after folders/deployments split.
- Local seeded login is explicitly opt-in and cannot be enabled on a public or production deployment.
- Public scan staging, login transfer and result publication each have a separate API contract; shared UI does not bypass those checks.
- Do not mark the migration complete until independent builds, preview callback URLs, cookies, CSRF, redirects and pending-intent handoff have been tested.
