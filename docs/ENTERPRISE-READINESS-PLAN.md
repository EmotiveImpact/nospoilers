# NoSpoilers production and enterprise readiness

Current identity and runtime decisions are summarised in
[Authentication, enterprise access and scan workers](AUTH-ENTERPRISE-AND-WORKERS.md). Neon Auth is
the selected ordinary-login provider; WorkOS remains a later SSO/SCIM adapter. A dedicated worker
per company is not the default architecture.

Reviewed 5 September 2026. Status: **build direction approved; launch gates open**.

## Read this first

Owner decision, 5 September 2026: no local Docker. Defer worker deployment/isolation validation; assess Railway later and adapt the current production container-mode guard before live scans. Continue **Gate B product journey/API-state parity** now. Gate A remains open for that deferred evidence, not a blocker to local product work. See `GATE-A-IMPLEMENTATION.md` for the recorded decision.

The product direction is coherent: connect a release surface, inspect what ships, act on exposure, preserve scoped proof, and monitor changes. Keep the approved mockup's clean layout and the current product's working backend capabilities. The application is not yet proven ready to hold enterprise customer evidence.

This is an implementation plan and repository review, not a penetration-test certificate, compliance attestation, or guarantee of security. Close gates with recorded evidence, not a percentage-complete badge.

## Authoritative documents and precedence

1. `docs/PRODUCT-DIRECTION.md` — accepted customer journey, terms and design principles.
2. `docs/WEB-APP-ARCHITECTURE.md` — website/product boundary, monorepo migration and domains.
3. This file — current build order, scope, acceptance gates and handoff checklist.
4. `docs/SECURITY-READINESS-REVIEW.md` — security findings, code evidence and verification required.
5. `docs/MOCKUP-PRODUCTION-CONTRACT.md` — screen/state mapping and prototype limitations.
6. `docs/ACCESS-BOUNDARIES.md`, `docs/expansion/FEATURE-INVENTORY.md`, `docs/STATUS.md` and `docs/HANDOFF.md` — existing backend contracts and historical implementation evidence. Recheck against code before calling a feature live.

Resolve contradictions in a changeset that updates the relevant documents together. Preserve the earlier Mock 3 and First Proof references. Every implementation handoff must list completed gate IDs, outstanding blockers, tests, routes, deployment environment, and changed documents.

## Readiness assessment

### Latest Gate A checkpoint — 5 September 2026

`GATE-A-IMPLEMENTATION.md` supersedes the earlier checkpoint below for pipeline/security implementation status. Browser and CI artifact jobs now share the durable path and installation release ledger. Role enforcement, aggregate staging budgets, pinned transport, restricted parser invocation, worker leases and immutable upload results are implemented. The scanner bundle runs successfully. **Gate A remains open** for real container isolation, production-like PostgreSQL concurrency/recovery and private deployment verification. Docker is unavailable locally; no deployment has been performed.

### Earlier implementation checkpoint — 5 September 2026

- Browser uploads and authenticated pending claims now reserve usage, enqueue a durable `uploaded_scan` job, and return a stable upload ID. Workers persist reports and signed scan records, clear artifact bytes, and expose queued/running/done/failed states through authenticated APIs and Releases.
- Package-only ownership is explicitly personal (`user_id`), not a fabricated GitHub installation. Direct uploads offer a workspace selector; installation uploads use that installation's membership, suspension, entitlement and usage rules. This is not yet the independent enterprise organization model.
- Added bounded request/remote-response reads, shared database rate buckets, browser mutation origin checks, read-only pending GET/protected POST, and explicit opt-in local review login.
- Verification checkpoint: 543 tests passed in 71 files using the reduced-concurrency command below; production build passed. Follow-up acquisition, workspace coverage and upload workflow checks passed (14 tests), including persisted API reopening, tenant isolation and cross-origin rejection. The real `/watch/scan` DOM shows the product shell, four evidence choices and the personal workspace selector.
- **No gate is closed in full.** CI still has its existing synchronous scan/ledger path; browser uploads currently have their own persisted records. Unified ledger, isolated parser processes, pinned outbound connections, aggregate staging quota, full role model and live deployment verification remain open. Do not advertise this checkpoint as enterprise ready.

| Area | Evidence in this review | Verdict |
| --- | --- | --- |
| Product architecture | `/scan` public, `/watch/scan` authenticated; persistent Coverage and release detail | Sound direction; integration incomplete |
| Backend foundations | Installation roles, encrypted credentials, hashed scan tokens, signed sessions/webhooks, domain verification, audit, retention and governance modules | Reuse and test; not a reason to rewrite |
| Browser scan lifecycle | `/api/scan` and pending claim return raw reports; `/api/v1/scan` persists receipts/releases and consumes installation usage | Launch blocker: unify |
| Request and upload security | Missing central CSRF guard; buffered bodies; process-local rate limits | Launch blockers |
| Worker/network boundaries | Scanner budgets and public-host checks exist; HTTP handlers also invoke scanning directly | Isolation and network enforcement need proving |
| Mockup | Good shell/evidence hierarchy; added daily Overview, release history, result states and Settings | Review target; simulated and incomplete |
| Enterprise identity | GitHub login/installation roles present; SAML/OIDC SSO and SCIM not found in reviewed source | New work before identity-dependent enterprise sales |
| Operations | Worker recovery/cron/health code present | Live restoration, alerting, load and failure evidence outstanding |
| Marketing | V20 visual shell present; some copy promises limits/coverage beyond verified behavior | Claims reconciliation required |

## Gate A — coherent product and secure scan pipeline (before external customer uploads)

**A1. One authenticated orchestration path.** Browser, pending acquisition, CI, registry and deployment submissions create an installation-scoped scan job. Capture artifact digest, source identity, request actor, engine/policy version, timestamps and idempotency key. Return a job ID; polling reads its status. Successful completion persists an immutable release revision, report and applicable proof. Reopening or refreshing resumes the same job. Anonymous intake only stages an intent.

Acceptance: exercise anonymous intake → login → claim → queue → result → Releases → re-open result using real persisted data. Repeat for a direct signed-in upload and CI token. No extra trial or duplicate scan on refresh. An API response alone is not a completed release workflow.

**A2. Installation, role and subscription rules.** Every new scan has an explicit tenant, including customers with no GitHub installation. Define a workspace model for package-only users rather than inventing a GitHub installation or relying on the best plan across unrelated installs. Check role and entitlement server-side; reserve usage atomically before queueing; release reservations on designated failures. Scope reads, export, retries, notifications and proof sharing.

Acceptance: two installations with admin/member/viewer roles; cross-tenant ID swaps and mixed paid/expired installations cannot grant extra access. Package-only onboarding produces a durable workspace.

**A3. Request and abuse protections.** Close security findings S1–S5. Enforce streamed size limits, shared quotas and upload expiry; use protected POST for claim/start. Public staging must have an aggregate storage budget, not just a per-file cap.

**A4. Isolated execution.** Run hostile parsing in bounded workers with CPU/memory/deadline controls, restricted filesystem and egress, tenant concurrency, queue fairness and cleanup on process death. Validate actual socket destinations for outbound scanning. Do not load customer archives in the public HTTP process. Scanner budgets are useful, but do not substitute for process isolation.

Acceptance: hostile archives, stalled responses, chunked bodies, redirected/private destinations, worker kill/restart, retries and bursts all end in bounded failure or an explicit inconclusive result. Never issue passing proof from partial work.

## Gate B — finish the approved product journey

**Accepted 8 September 2026.** B0–B8 completion is recorded in `GATE-B-COMPLETION-AUDIT.md` and `GATE-B-FINAL-EVIDENCE-MATRIX.md`. Final regression38375:986 tests/198 files pass; build27665 passes. Historical in-progress notes below are superseded. This closes the product-flow gate only; deferred A/C/D/E and provider/operational work remain separate.

**B0. Identity/workspace foundation.** Follow `IDENTITY-WORKSPACES.md`: provider-neutral product identity, independent workspaces and GitHub installation connections, internal-member assignment and subscription-wide limits. This is a schema/auth migration, not a cosmetic switcher. Begin scope-safe UI/state fixes now; Gate B cannot be declared complete while required workspace creation/membership flows remain simulated. Provider choice and proposed commercial caps need confirmation before rollout.

Current implementation evidence: `GATE-B-COMPLETION-AUDIT.md`, with migration history in `GATE-B-IMPLEMENTATION.md` and the source-specific Gate B documents. Independent workspace management/membership, GitHub connection binding, verified website scanning, billing ownership, tokens, notifications and scoped exceptions now exist; the earlier migration077/615-test checkpoint is historical. The owner approved explicit deletion authorization and retained history rather than automatic erasure on disconnection. Remaining flow/state and rendered acceptance requirements are tracked in the completion ledger; none is closed merely by this summary. Provider selection and rollout remain deferred. Gate B remains in progress.

**B1. First Proof and Setup.** Keep the four-circle journey on first login. Turn Setup into contextual connection details and diagnostics. Its current five technical capabilities are optional coverage checks, not five mandatory onboarding steps. Explain missing GitHub permissions and unconfigured local services in one place. Do not make a package-only customer install GitHub.

**B2. New Scan.** GitHub chooser, package upload, website ownership, proof verification. Show supported formats and real size limits. Add validation, upload progress, cancel, staged expiry, login return, queue state, retry, unsupported format, permission denied and expired trial. Progress describes real phases, not invented file counts or timer percentages.

**B3. Coverage.** Persistent source inventory with last successful check, cadence, owner, scope, connection health, next check and latest release link. Add connect/edit/pause/remove/reconnect flows. Keep connection health distinct from release risk. An old clean result with delayed monitoring is stale, not healthy current evidence.

**B4. Releases and Release Detail.** History with filters and URL-backed selection; independent preview; full detail by stable ID. State taxonomy: queued, running, failed, inconclusive, findings present, policy passed, policy passed with exception. Show scope, excluded/unsupported checks, digest, time, policy/engine revision and provenance. Preserve older attempts when rescanning.

**B5. Alerts.** Open / In progress / Resolved with independent ownership filter. Show evidence, owner, response history, next step and related release. Distinguish finding disposition from technical remediation. Resolving an alert records a workflow action; it does not edit the scan result or retroactively turn an artifact clean. Exceptions need justification, independent approval where required, scope and expiry.

**B6. Proof.** Explain “this artifact passed these checks at this time.” Show valid/invalid/unrecognized issuer/revoked/mismatch outcomes. Public verification exposes an explicit redacted projection, not internal evidence or secret material. Provide private-by-default sharing with clear preview and revoke controls. Verification consumes no scan job.

**B7. Daily Overview.** Automatically replace First Proof once actual evidence exists. Summarize release decisions, open exposure, delayed coverage and next actions. No global safety score that hides unknown scope. Every count opens its relevant filtered view.

**B8. Settings.** Reuse current role, policy, retention, token and notification APIs. Separate workspace settings from operator-only disclosure/prospect tools. Add inspectable status, save/error feedback and audit trail. Do not label SSO/SCIM “connected” before implementing them.

Acceptance: all core flows work against real APIs; browser back/forward and reload preserve selection; no customer screen contains sample data; every disabled action explains what is required and who can do it.

## Gate C — design, accessibility and website/product separation

**C1. Shared components.** Extract page heading, source picker, status badge, async state, evidence table, decision panel, side preview, empty state, dialog and settings row. Use one token set for black surfaces, off-white text, product red, spacing, typography and the quiet central spotlight. Keep gradients decorative; text must remain readable without them.

**C2. Responsive/accessibility.** Check 390, 768, 1024 and 1440 CSS pixels and 200% zoom. Keyboard navigation, visible focus, tab arrows, modal focus/return, input labels, error announcements, focus on route changes, text contrast, reduced motion, table reflow and long package/URL wrapping. Target WCAG 2.2 AA, then verify with automated and manual checks; screenshots cannot establish compliance.

**C3. Mockup parity.** Follow `MOCKUP-PRODUCTION-CONTRACT.md`. Preserve working backend controls while fitting them into the approved layout. Keep a state fixture gallery outside the production bundle. The screenshot transport in this review produced cropped/scaled captures; reliable visual acceptance requires a full viewport capture before final fidelity sign-off.

**C4. Monorepo.** Follow `WEB-APP-ARCHITECTURE.md`: stabilize the shared job contract, extract UI/contracts, then move web/app code. Keep product API calls same-origin through routing even if the API deploys independently. Prove auth callbacks and signed pending-intent exchange on preview domains before DNS changes. Physical folder separation alone creates no authorization boundary.

**C5. Website completion.** Finish product use cases, pricing, security/trust, docs/quickstart, integrations, enterprise contact, status/support and legal pages. Each claim must map to shipped behavior. Replace internal engineering/business-strategy copy with customer language. Use a real product-derived, labelled preview; avoid showing unbuilt scanner categories or invented certifications/customer logos. Self-service uses the five-day trial; enterprise evaluations use agreed success criteria and timeline.

## Gate D — operational launch evidence

**D1. CI:** reproducible install, typecheck, lint, frontend/API build, stable test suite, hostile scanner fixtures, dependency advisory review, secret scanning, browser journey tests and migration tests. Pin reusable CI actions to reviewed commits. Resolve failures by cause; do not hide timeouts by disabling tests.

**D2. Observability:** job age/failure/retry rates, scan duration, queue depth, tenant usage, OAuth failures, webhook lag, notification delivery, storage growth and deletion backlog. Alert on actionable thresholds. Correlate request/job/release IDs without recording uploaded bytes, credentials or matched secret values.

**D3. Recovery:** restore a backup into an isolated environment; verify tenant boundaries and data integrity; document measurable recovery targets. Test deployment rollback and a forward-compatible schema migration. Test signing/encryption key rotation and compromised token revocation.

**D4. Service behavior:** live GitHub install/OAuth/webhook cycle, test-mode Stripe lifecycle, notification failures/retries, domain proof, CI submission and worker resumption on a private preview deployment. Build success is not this evidence.

**D5. External review:** threat model and ASVS checklist, independent penetration test with cross-tenant and hostile-upload scope, triage/remediation and retest. Report open exceptions explicitly. Do not claim “fully secure.”

## Gate E — enterprise offer

Build on the same evidence engine and data model. Enterprise is organizational control, integration and service assurance around the product.

1. Organization tenancy independent of a GitHub installation, explicit multi-install ownership and workspace switching.
2. SAML/OIDC SSO, domain verification, enforced identity policy, safe recovery and session revocation. Add SCIM provisioning/deprovisioning for buyers who require it; test immediate loss of API/session access.
3. Granular roles, service accounts and scoped expiring tokens. Approvals with separation of duties and auditable emergency access.
4. Central policy with versioning, exceptions with expiry and review, policy comparison and per-project inheritance.
5. Durable audit export/SIEM, legal hold and configurable retention. Establish deletion behavior for live data and backups.
6. Procurement pack: architecture/data-flow diagram, security responsibilities, subprocessors, data locations, support/escalation, incident response, contractual service objectives and a reviewed DPA. Legal documents and certification assertions require appropriate professional review.
7. Assess dedicated workers, regional hosting, private connectivity and customer-managed keys against actual customer requirements before promising them.
8. A structured pilot: buyer and technical champion, two or three representative release surfaces, baseline exposure, time to first valid result, successful remediation/recheck, CI adoption and demonstrated policy/audit export. Agree paid-conversion criteria and owner before starting.

Gate E acceptance: demonstrable identity lifecycle, tenant isolation, policy enforcement, recovery evidence and an accurate procurement pack. A polished Settings mockup is not evidence of these controls.

## Work packages and dependencies

| Order | Package | Depends on | Required exit evidence |
| --- | --- | --- | --- |
| 1 | Browser/CI/pending shared scan lifecycle + workspace scope | Current routes | Persisted release after each entry path; refresh/idempotency tests |
| 2 | HTTP protection, resource budgets and shared limits | 1 contract | S1–S5 negative tests and adversarial resource tests |
| 3 | Worker egress/isolation + key lifecycle | 1–2 | DNS/socket tests, process kill, concurrency and rotation exercises |
| 4 | Production UI parity across B1–B8 | Stable APIs | End-to-end fixtures and live preview journeys |
| 5 | UI/contracts extraction and web/app move | 1 and 4 | Independent builds, same-origin API routes, auth handoff |
| 6 | Website claims, accessibility, operational release gate | 2–5 | Browser matrix, restore/load tests, live integration evidence |
| 7 | Enterprise tenancy/identity/policy + procurement pilot | 2–6 | Gate E acceptance and independent security retest |

These are sequencing estimates, not a calendar commitment. Backend/API contracts can be specified alongside UI work; do not implement enterprise screens against invented response shapes.

## Current review verification

- Baseline full test command: 498 passed / 40 failed, with three unhandled errors. Many failures were 5-second database timeouts; local listener creation also failed with sandbox EPERM. This result is not an application pass.
- Reduced-concurrency rerun with local listener permission and the existing CI fixture environment: `env NOSPOILERS_INTERNAL_LOCAL_SCAN=1 npm test -- --maxWorkers=2` — **538/538 tests passed across 70 files**, without the earlier unhandled errors. This explains the initial local run's failures; it does not close security gaps that the tests do not cover. Make this reliable execution profile reproducible in CI.
- Prototype changes are local and simulated. No external deployment, database migration, production security configuration, or customer notification was performed in this review.

## Next implementation instruction

Continue Gate B: first compare the actual production screens/API behavior with the approved master-flow prototype and `MOCKUP-PRODUCTION-CONTRACT.md`; implement missing states rather than rebuilding completed flows. Prioritize New Scan → Coverage/Releases → Release Detail, then First Proof/Daily Overview, Alerts, proof presentation and Settings. Worker deployment validation is explicitly deferred per the owner decision above; keep Gate A open for its remaining evidence. Read all authoritative documents first. Preserve existing dirty work, maintain `/scan` versus `/watch/scan`, do not introduce sample customer results, do not bypass subscription enforcement, and do not issue passing proof for inconclusive work. Update this plan and companion documents with evidence as each gate closes.
