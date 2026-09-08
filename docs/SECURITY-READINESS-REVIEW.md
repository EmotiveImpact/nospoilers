# Security readiness review

Billing prerequisite 087: job billing ownership is immutable; shared personal-payer concurrency no longer falls through an alternative SQL branch. Refunds consume a single durable reservation, and retries check the saved payer's current entitlement. Existing queued records are backfilled without a new usage charge. This does not change authentication, authorize tenant reassignment or complete the GitHub connection security model.

Gate B continuation through migration 086: explicit workspace membership now protects source list/get reads and upload publication checks; revoked stale membership cannot grant proof sharing. Uploaded public proof uses a whitelisted immutable projection and hashed 256-bit capability, explicit admin publication, rate-limited anonymous reads and revocation. Personal billing rejects retired subscriptions and stale signed events; ambiguous ordering still needs provider reconciliation. Artifact policy is server-enforced and snapshotted before parsing. Deletion has an owner-scoped inventory and typed review consent only: no recent-auth/hold-aware purge execution exists yet. These are local implementation improvements, not a claim of complete security or enterprise readiness. See current Gate B tracker for test evidence.

Retention policy is now owner-approved; see DATA-LIFECYCLE-POLICY.md. Explicit typed authorisation is required for permanent history deletion, including closure requests. This does not permit bypassing legal holds/append-only protections or deleting records as part of this implementation task. Earlier pending-policy statements are historical.

Current local hardening through `080`: product workspace/organisation/billing/connection events reject UPDATE, DELETE and TRUNCATE; personal billing binds immutably to its original organisation/user and signed webhook claim/application is transactional. Explicit unused connection placement checks both workspace/source and organisation authority, refuses existing resources, and prevents GitHub-login bootstrap grants afterward. These are tested local protections, not full source migration or external security validation. Retention approval remains pending.

Gate B continuation, 5 September: provider-neutral workspace/organisation membership and billing authorisation now have explicit owner protections; connection routes fail closed on cross-workspace selection. Source disconnect locally stops work and revokes scan tokens without deleting billing or history. Focused regressions cover shared billing without sibling-source access and source-disconnect survival. This retained-history policy awaits owner confirmation/public-copy reconciliation before deployment. New product event tables still need database append-only enforcement, and full source/worker ownership migration remains incomplete. These are implementation checkpoints, not an enterprise security certification.

Latest checkpoint (5 September 2026): read [Gate A implementation](GATE-A-IMPLEMENTATION.md) before older status notes below. Queued browser/CI artifact processing, installation-ledger completion, viewer enforcement, staging budgets, pinned HTTPS and restricted parser invocation are now implemented. Migration marker is `070_immutable_upload_results`. Container runtime, production-like concurrency/recovery and private deployment verification remain required; no launch-readiness claim or deployment is implied. Preserve existing user changes and mockups.

5 September 2026. Scope: targeted source review of Hono HTTP handlers, upload/claim flows, runtime configuration, outbound website fetching, rate limiting, credential storage, deployment configuration and prototype code. This is not a complete endpoint audit or live penetration test.

## Executive finding

Implementation update (5 September): S1/S2/S3/S5/S7/S8 have partial mitigations in the local working tree: durable browser upload jobs with scoped atomic usage; bounded inbound/outbound reads; mutation-origin checks and POST claims; shared database rate limits; explicit `NOSPOILERS_LOCAL_REVIEW=1`; private API cache/nosniff/referrer headers. The evidence below describes the original review baseline. These findings remain open until their complete acceptance tests and deployment controls are established. In particular CI parsing remains synchronous, egress DNS is not socket-pinned, staging needs an aggregate storage budget, proxy trust is unverified, and CSP/key lifecycle/enterprise identity remain outstanding.

Do not open enterprise uploads yet. Useful protections exist, but browser scans bypass parts of the persisted CI lifecycle, request bodies are fully buffered before size checks, outbound DNS checks are separate from connection resolution, and the request/abuse boundary needs strengthening. Severity below distinguishes confirmed source behavior from deployment-dependent exploitability.

## Existing protections worth retaining

- Production secret strength rejection: `src/server/secrets.ts:37`.
- HttpOnly, SameSite=Lax cookies, Secure on HTTPS: `src/server/cookies.ts:1`.
- Random session IDs, expiry, encrypted integration/OAuth tokens and hashed scan API tokens.
- GitHub and Stripe webhook signature validation; installation role checks; domain ownership verification.
- Scanner input/file/depth/unpacked-byte/deadline limits: `src/scanner/index.ts:68`; incomplete work can return inconclusive.
- Outbound HTTPS and public-address checks, redirects rejected: `src/server/web-origin.ts:326`.
- Existing tenant, role, receipt, retention and governance tests. Passing test coverage must still be established in the launch environment.

## Findings

### S1 — High: browser scan path lacks the CI path's usage and release persistence contract

Evidence: `src/server/app.ts:1756` calls `scanUploadedBytes` and returns the raw report; `src/server/app.ts:2098` claims and runs a pending scan. By comparison, `/api/v1/scan` at `src/server/app.ts:3491` authenticates an installation token, consumes hosted usage at line 3534 and persists receipt/release evidence. The browser path uses the best coverage across user installations (`hostedCoverageForUser`, near line 869).

Impact: a covered user can use a less-governed scan route; uploads do not necessarily become the durable release record the UI promises. Mixed-install entitlement can also diverge from the intended tenant policy. No arbitrary cross-tenant data read is established by this finding.

Fix: common installation-scoped orchestration and atomic usage reservation for all starts; persist one immutable result path. Define package-only tenant ownership. Test both API routes and pending claims under expired/mixed plans and repeated submissions.

### S2 — High: body limits apply after allocation and parsing runs in HTTP handlers

Evidence: `src/server/app.ts:1795` and `:3532` call `c.req.arrayBuffer()` before size rejection; `src/server/web-origin.ts:317` does the same for remote responses. `scanUploadedBytes` at `app.ts:723` invokes the scanner inside the request path. Existing scanner budgets do not cap the initial body allocation or forcibly preempt synchronous parser work.

Impact: a large/chunked body or concurrent hostile uploads can exhaust memory or tie up request capacity before a limit is enforced. Exact exposure depends on ingress limits, which were not verified.

Fix: streamed byte limits and early rejection, capped outbound reads, explicit empty-body handling, bounded staged storage and isolated queued processing. Test missing/false Content-Length, chunked growth, decompression bombs and cancellation. Align UI limits to actual hosting limits; 80 MB application limits do not establish Vercel ingress support.

### S3 — High hardening gap: no central CSRF/origin protection; GET starts work

Evidence: the only `app.use` in `src/server/app.ts:921` is internal authorization. No central Origin/Sec-Fetch-Site/CSRF middleware was found. `/api/scan/pending` at line 2098 is GET but claims ownership and runs scanning. Cookie settings at `src/server/cookies.ts:1` use SameSite=Lax.

Impact: unintended credentialed state changes are insufficiently protected, particularly under same-site subdomain compromise or top-level navigation to a stateful GET. SameSite limits ordinary cross-site POSTs; this is not a claim that every endpoint has a demonstrated cross-site exploit.

Fix: protected POST to claim/start; read-only GET to query status. Enforce exact trusted origins and CSRF tokens or an equivalently reviewed design for cookie mutations. Signature-authenticated webhook and bearer API routes have explicit separate handling. Test malicious same-site origins, missing headers, anonymous form bodies and replay without weakening legitimate integrations.

### S4 — High, conditional: DNS check does not bind to the socket destination

Evidence: `src/server/web-origin.ts:333` calls `assertPublicWebhookHost` then line 340 calls ordinary `fetch(url.href)`, which resolves the hostname independently. Similar pattern in `src/server/siem.ts:145` and `:151`.

Impact: a DNS change between validation and connection may reach a prohibited address where network routing allows it. Private-address rejection tests alone do not prove protection against rebinding. No live exploitation was attempted.

Fix: approved egress proxy or connection-level resolver that pins vetted addresses while preserving TLS host validation; block private/reserved destinations at network level. Test dual-stack, rebinding, redirect and metadata cases with controlled local doubles.

### S5 — High operational gap: abuse controls are per-process and header-dependent

Evidence: `src/server/rate-limit.ts:2` stores hits in an in-memory Map; line 19 trusts the first forwarded address. `src/server/app.ts:675` supplies request headers. Anonymous staging uses this limiter. Expired keys are not globally evicted from the Map.

Impact: limits reset with process restarts and do not combine across replicas. Direct deployments with untrusted forwarding headers may permit IP rotation; staging traffic can amplify storage and memory costs.

Fix: distributed atomic limits for tenant/user/token and trusted ingress IP; bounded staging storage and expiry sweeps; queue fairness; quotas independent of IP. Verify proxy sanitization at the deployment edge. Test replica/restart and forwarded-header cases.

### S6 — Medium: cookie, credential encryption and receipt keys share a lifecycle

Evidence: `src/server/runtime.ts:32` uses `config.sessionSecret` as `tokenSecret`; `src/server/config.ts:162` falls back to the session secret for receipts. Strength checks do not require a distinct receipt key.

Impact: compromise or rotation of one key affects multiple security functions; careless rotation can make stored credentials unreadable or invalidate proof unexpectedly.

Fix: distinct keys with explicit version identifiers and managed rotation/migration; documented old-proof verification and revocation behavior. Validate secrets and required services in production at startup.

### S7 — Medium: development login relies on environment/config, without an explicit opt-in

Evidence: `src/server/app.ts:696` permits review login unless NODE_ENV is production and checks the configured base hostname; `src/server/index.ts:14` binds the server to `0.0.0.0`.

Impact: a development instance exposed through a LAN/tunnel with loopback configuration may offer the seeded review account remotely. This is a configuration hazard, not a demonstrated production bypass.

Fix: explicit disabled-by-default local-review flag, startup environment checks, loopback binding for local review and no development handler in the production deployment. Test public/misconfigured preview hosts and tunnels.

### S8 — Medium: response security policy not visible in reviewed deployment code

Evidence: no CSP, frame protection or private API cache policy was found in `vercel.json` or the reviewed Hono middleware. Edge settings may exist outside the repository.

Fix: verify live headers for HTML, API, downloads and errors; enforce appropriate CSP, frame-ancestors, nosniff, referrer policy and no-store on private responses. Keep public proof caching deliberate. Do not report absent live headers as confirmed until measured.

### S9 — Medium hardening: prototype assets share the public application build

Evidence: `public/mockup-review/master-flow/index.html:11` loads external icon script; prototype `app.js` interpolated editable assignee/notes into innerHTML. Those editable fields are escaped in this review. The assets remain under Vite `public/` and are copied into builds.

Impact: review code and third-party scripts gain the deployed origin's privileges if served there. No remotely supplied stored-XSS vector was established; editable local notes are not by themselves a remote exploit.

Fix: exclude prototypes/QA artifacts from production or deploy to an isolated review origin without customer cookies. Apply production rendering rules to any UI moved into React; never copy prototype HTML interpolation into evidence rendering.

### S10 — Medium governance gap: staged bytes and retention claims need reconciliation

Evidence: `src/server/store.ts:1919` inserts raw artifact bytes into `pending_scans`, clears them on successful processing and deletes expired rows. This does not establish per-object application encryption, backup deletion or guaranteed deletion immediately after all failures.

Fix: documented staging encryption/storage boundary, expiry sweeper for every runtime role, storage quotas and deletion evidence covering failures, abandoned scans and backups. Use scoped retention copy. Provider encryption at rest was not verified, so this report does not claim the database is unencrypted.

## Required further evidence

- Complete role/resource matrix across every endpoint, including internal operators, exports, jobs, integrations, billing and public sharing. Audit admin bootstrap from GitHub membership; prove no unintended first-user privilege escalation.
- Review OAuth scopes, session expiry/revocation, membership removal, webhook replay, token scope/expiry, proof forgery/revocation and HTML/download rendering.
- Dependency advisory check and lockfile/CI supply-chain review; no “zero vulnerabilities” assertion from this review.
- Isolated PostgreSQL migration, backup restore, load/queue tests, external integration checks and an independent penetration test/retest before enterprise sign-off.

Use [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) as a traceable verification checklist. Hono supplies [CSRF](https://hono.dev/docs/middleware/builtin/csrf), [body limits](https://hono.dev/docs/middleware/builtin/body-limit) and [secure headers](https://hono.dev/docs/middleware/builtin/secure-headers); adopting middleware still requires route-specific tests and deployment validation.

Production security fixes remain planned in `ENTERPRISE-READINESS-PLAN.md`; this review changed only mockup code and documentation.
