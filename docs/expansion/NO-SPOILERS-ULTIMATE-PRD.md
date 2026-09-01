# NoSpoilers Ultimate — Product Requirements Document

Status: expansion plan  
Owner: Emotive Impact  
Tagline: **no spoilers in production.**  
Canonical feature inventory: `docs/expansion/FEATURE-INVENTORY.md`

## 1. Product definition

NoSpoilers verifies the bytes customers actually receive and watches the access changes through
which private work becomes public.

It covers three doors in one product:

1. **Release artifacts** — packages, archives, extensions, deployment bundles, and later installers.
2. **Deployed web assets** — JavaScript, CSS, maps, configs, and debug files served in production.
3. **GitHub exposure** — publicize, born-public, transfer, collaborator, fork, and release events.

The product combines prevention before release, automatic verification after release, and incident
response when something escapes.

## 2. Why it exists

Repository scanners inspect source control. Customers receive a different object: an npm tarball,
ZIP, asar, browser extension, website bundle, or installer. Build tooling can add maps, source,
credentials, prompts, internal paths, and debug material after source review.

NoSpoilers wins by inspecting that final object and continuously watching the release/exposure
surface. It is not another generic SAST, dependency, antivirus, or code-review platform.

## 3. Customers

### Primary

- Solo founder shipping a proprietary npm CLI, SDK, extension, or desktop/web application.
- Release/platform engineer at a 10–100 person software company.
- Security engineer responsible for release hygiene without a large AppSec platform.

### Secondary

- AI product team protecting prompts, agent instructions, memory, and tool configuration.
- Consultancy responsible for multiple client release pipelines.
- Larger organization needing audit evidence and routing, after the self-serve product works.

## 4. Jobs to be done

- “Before publishing, prove the final package does not contain material we meant to keep private.”
- “Watch every release even when someone forgets the CI step.”
- “Tell me immediately when a private repository or relationship changes.”
- “Show exactly what changed since the last approved release.”
- “Route the incident to the right person and record what they did.”
- “Keep source and credentials out of the scanning vendor’s database.”

## 5. Product principles

1. Scan packed/deployed bytes, not only Git.
2. Prevention first; post-publication monitoring is a backstop.
3. Never retain artifact source after a scan.
4. Never include credential values in reports.
5. Deterministic findings before AI explanations.
6. Webhooks acknowledge quickly; heavy work stays in queues.
7. Customer jobs always outrank internal prospecting.
8. Sell coverage, not scan counters.
9. High-permission remediation is opt-in and confirmed.
10. A format is not advertised before hostile fixtures and resource limits exist.

## 6. Cross-cutting result contract

Every scan records tenant/source, artifact coordinate and SHA-256, engine/ruleset version, effective
policy hash, applied limits, timestamps, manifest, finding fingerprints and temporary-byte deletion
outcome.

States are explicit: queued, running, passed, failed-policy, inconclusive, error, cancelled. A hard
limit, timeout, unsupported encryption, malformed archive, partial download or extraction failure
is **inconclusive**, never clean and never eligible for a passing receipt.

Nested formats are identified by magic bytes, not extension alone. Aggregate input, expansion,
file, depth, CPU/memory and time limits apply across the complete logical path. No customer code,
package lifecycle script, image, mobile app or installer is executed.

## 7. Product surfaces

### Public

- Product landing
- Pricing
- Documentation
- Privacy, Terms, retention and responsible disclosure
- GitHub App installation and OAuth callback

### Customer

- Watch — repositories, exposure events, alerts, timeline
- Scan — upload/on-demand results
- Releases — watched packages, versions, diffs, approvals, receipts
- Policies — baseline, allowlist, `.nospoilers.yml`, routing
- Integrations — GitHub, npm, Sentry/Bugsnag, email, Slack, Jira, webhooks/SIEM
- Team — members, roles, organizations, retention
- Billing — plan, trial, invoices, portal
- Operations — queue status, notification delivery, installation test

### Internal

- Artifact Leads
- Finding verification
- Responsible-disclosure queue
- Acquisition attribution
- System health and failed jobs

## 8. Commercial model

### Solo — $29/month

- One GitHub user or one owned organization
- All granted repositories
- GitHub exposure alerts
- npm/GitHub Release monitoring
- Hosted scans, fair use
- CI Action and policy
- Email

### Team — $99/month

- Company organization
- All repositories in the installation
- Higher fair-use concurrency
- Slack, Jira/webhook routing
- Team roles
- 90-day timeline and audit export

### Shared

- 14-day full trial with payment method collected through Stripe
- Yearly: 10 months for 12
- No free-forever hosted tier
- No scan-credit UI
- Marketplace is optional after 100 installations; Stripe on our site is primary
- No public Enterprise tier until requested

## 9. Phased delivery plan

Each phase has an exit condition. Do not describe later phases as available before the exit passes.

### Phase 0 — runtime truth

Scope:

- Boot the actual application against Neon `NoSpoilers` / `production` / `neondb`.
- Keep Neon Auth disabled; use GitHub OAuth.
- Run idempotent migrations.
- Prove temporary writes and event-driven job wake-up.
- Keep PGlite only as local fallback.

Acceptance:

- Runtime health identifies Postgres mode without exposing the URL.
- A write/read/delete probe completes.
- API-enqueued work begins immediately.
- Empty queue does not poll every 500 ms.
- Full tests pass.

### Phase 1 — real hosted and commercial spine

Scope:

- Register real GitHub App and configure OAuth/install/webhook secrets.
- Verify installation ownership; prevent arbitrary installation-ID linking.
- Prove throwaway private → public and release-asset scan.
- Verify app suspension, permission changes, repository add/remove and uninstall health.
- Introduce billing accounts attached to GitHub installations.
- Enforce coverage in webhook enqueue, claim/handle, poller, upload, and release routes.
- Add Stripe monthly/yearly products, Checkout, trial, lifecycle webhooks, and Billing Portal.
- Add Resend email adapter and delivery state.
- Deploy web/API/normal worker on Railway with Neon and Cloudflare DNS.
- Secure cookies, encrypted OAuth tokens, rate limits, strong secret checks.
- Add retries, stale-lock recovery, failed jobs, readiness and structured logs.
- Publish legal/support pages.

Acceptance:

- Customer can sign in, pay/start trial, install, and receive a real alert.
- Stripe cancellation/failed payment stops all hosted work for that installation.
- Webhooks still return promptly while uncovered work is skipped.
- No anonymous route can create unbounded compute.
- Production survives process restart without losing jobs.
- Customer bytes are removed after scanning.

### Phase 2 — automatic release protection

Scope:

- Watched npm packages with automatic version, dist-tag and prerelease-channel detection.
- Detect changed tarball bytes under an existing immutable package/version coordinate.
- Optional private npm registry credentials, encrypted and least-privileged.
- npm/pnpm/Yarn/Bun workspace discovery.
- App-generated PR installing the existing pre-publish Action.
- GitHub Checks with rule/path annotations.
- Release manifests containing path, size, digest, scanner and policy versions.
- Release Diff against the last approved version.
- Baseline approval and expiring allowlist with actor/reason.
- `.nospoilers.yml` policy.
- Unexpected size/file changes, nested archives, suspicious symlinks, source archives, backups,
  database dumps, cloud/SSH configs, crash/debug/build material, internal docs, and AI-context rules.
- Signed scan receipts and external scan API.

Acceptance:

- A customer connects a package and its current release is scanned without uploading manually.
- The next version scans automatically.
- CI blocks a critical fixture before publish.
- Release Diff reports only introduced/removed/changed risk.
- Baseline exceptions are attributable, expiring, and never suppress unrelated rules.
- Receipt verifies the artifact SHA-256 that was scanned.
- Limited, malformed, encrypted, timed-out or partial work is inconclusive and cannot receive a
  passing receipt.
- Generated setup PR is reviewable, never auto-merges, and explains that only configured publish
  paths are gated.

### Phase 3 — integrations, team and incident response

Scope:

- Slack, Jira, SIEM/custom webhook, optional PagerDuty.
- Routing by severity, repository, package, team, and destination.
- 90-day Team timeline; configurable retention.
- Multiple GitHub organizations and team roles.
- Audit export and notification-delivery history.
- Live installation/permission/delivery test without inventing a security incident.
- Acknowledge, assign, resolve, add evidence, and track exposure duration.
- Provider-specific credential-rotation checklist.
- Automatic remediation PRs for package files, ignore rules, bundler settings, and CI.
- Confirmed one-click make-private, bad Release asset removal/suspension, and unsafe workflow disable.
- Queue/usage health and public service status.
- SSO/SAML only after a real request.

Acceptance:

- Team can route a test delivery and a real critical finding.
- Every incident has owner, timestamps, state and immutable activity.
- Remediation actions show required GitHub permission before consent.
- Destructive actions require explicit typed confirmation and audit entry.

### Phase 4 — additional release surfaces

Scope:

- Web deployment crawler for JS/CSS, maps, exposed files, credentials, internal endpoints and paths.
- Sentry/Bugsnag map custody: matching release/debug ID, successful private upload, absent public map.
- VSIX, Chrome CRX/ZIP and Firefox XPI extensions.
- Python wheel and source distributions.
- Java JAR/WAR.
- NuGet NUPKG/SNUPKG and Ruby gems.
- Serverless deployment bundles.
- Docker/OCI layers later in this phase.
- APK/AAB and IPA only after archive safety and signing semantics are defined.

Acceptance per format:

- Real clean and dirty fixtures.
- MIME/magic validation rather than extension alone.
- Path traversal, expansion, file-count, file-size and timeout tests.
- Correct manifest and findings.
- Documented unsupported encryption/signing cases.
- No claim on Pricing or upload UI until all checks pass.

### Phase 5 — internal acquisition engine

Scope:

- Scheduled GitHub discovery and continuous public npm version feed.
- Configurable campaigns and nested workspace discovery.
- Critical-only internal notifications.
- Human verification with false-positive/reproducibility checklist.
- Duplicate company/artifact/finding detection.
- Contact, disclosure deadline, acknowledgement, fix and conversion states.
- Responsible-disclosure drafts; no automatic send.
- Automatic fixed-version rescan.
- Trial/paid attribution.
- Anonymized aggregate research after review.

Acceptance:

- Scheduled runs cannot starve or share queues unfairly with customer work.
- No source or credential value persists.
- No maintainer is contacted without human approval.
- A lead cannot be called “verified” without repeatable artifact/version/hash evidence.
- Aggregate reports cannot identify organizations without permission.

### Phase 6 — Electron installer worker

Product surface remains NoSpoilers; infrastructure is separate.

Scope:

- One disposable isolated container per installer.
- DMG → macOS app → `Contents/Resources/app.asar`.
- Windows EXE/NSIS → `resources/app.asar`.
- AppImage, then MSI.
- Electron fuses, ASAR integrity, signing/notarization and dangerous packaging settings.
- Existing scanner runs on located resources.

Limits:

- 4–8 GB RAM, 10 GB ephemeral disk, 2 vCPU.
- 300 MB compressed, 3 GB extracted, 100,000 entries.
- Five-minute hard timeout.
- Non-root; no installer execution; network disabled after download.
- Container and disk destroyed after report.

Acceptance:

- Hostile fixtures cannot escape, execute, exhaust quota or access customer queues.
- One failed installer cannot affect API/normal worker.
- Every supported platform has signed and unsigned fixtures.

### Phase 7 — scale and optional enterprise work

Scope only when needed:

- Separate worker pools and autoscaling.
- Per-installation fair-use concurrency.
- Regional processing and residency.
- SSO/SCIM, longer retention, private networking, DPA/SLA.
- Marketplace paid listing after eligibility.
- Enterprise plan only after a buyer requests requirements.

## 10. Data model direction

Core entities:

- `users` — GitHub identity only
- `sessions`
- `github_installations`
- `installation_members`
- `billing_accounts`
- `subscriptions`
- `repositories`
- `watched_packages`
- `release_artifacts`
- `artifact_manifests`
- `scan_runs`
- `findings`
- `baselines`
- `policy_exceptions`
- `jobs`
- `alerts`
- `notification_destinations`
- `notification_deliveries`
- `incidents`
- `incident_events`
- `integration_credentials` — encrypted
- `audit_events`
- `prospects` — internal and logically separated

Do not store extracted source or credential values.

## 11. Service architecture

```text
Browser
  → Web/API
      → Neon Postgres
      → Stripe / GitHub / npm / Sentry / Resend / Slack
      → immediate queue wake

Normal worker
  → visibility and metadata jobs
  → bounded tgz/zip/asar/package scans

Internal prospect worker
  → customer work first
  → one public artifact at a time

Installer job service
  → isolated disposable container
  → DMG/EXE/AppImage/MSI only
```

Production artifacts use temporary worker disk and are deleted in `finally`. Database and object
storage never become an archive of customer source.

## 12. Security and privacy requirements

- Verify GitHub, Stripe, and integration webhook signatures.
- Encrypt OAuth tokens, registry credentials, Slack/webhook secrets.
- Use least permissions and show permission changes before reauthorization.
- Protect internal routes independently from customer login.
- Rate-limit auth, upload, scanning, and discovery.
- Validate download host before and after redirects; defend against SSRF.
- Validate magic bytes; bound compressed/uncompressed size, files, nesting, CPU and time.
- No archive extraction with path traversal or symlink escape.
- No execution of customer code or installers.
- Report path/rule/fingerprint; redact values.
- Document deletion and retention.
- Audit administrative and destructive actions.
- Internal prospecting is public-artifact-only and human-reviewed.

## 13. Success metrics

### Activation

- GitHub install completed.
- At least one repository/package connected.
- First real scan or visibility check succeeds.
- Notification delivery tested.

### Product

- Median time from webhook to light alert.
- Median/95th percentile heavy scan queue and runtime.
- Percentage of watched releases automatically scanned.
- Critical findings caught before publish vs after publish.
- Notification success rate.
- False-positive dismissal by rule.

### Commercial

- Visitor → trial → activated → paid.
- Solo/Team mix and blended MRR.
- Gross and net logo churn.
- Expansion and net revenue retention.
- Cost per active installation and heavy scan.
- Customer concentration.

### Internal acquisition

- Public artifacts checked.
- Verified critical findings.
- Responsible disclosures acknowledged/fixed.
- Trial and paid conversion from verified findings.

## 14. Explicit non-goals

- General SAST or AI code review.
- General dependency CVE platform.
- Antivirus/malware sandbox.
- Secret manager/vault.
- Customer source retention.
- Automatic public disclosure or unsolicited bulk outreach.
- Scan-credit pricing.
- DRM as the commercial moat.

## 15. Agent execution rules

- Read `docs/PRODUCT.md`, this PRD, and the feature inventory before implementation.
- Build phases in order and satisfy acceptance criteria.
- Do not rewrite `src/scanner/` when extension is enough.
- No mock findings or seeded prospect leads.
- Keep one runnable product on port 4347 during local work.
- Preserve empty/loading/error/ended states and mobile layouts.
- Commit and push each logical change; no PR unless explicitly requested.

No phase is complete until real integration paths pass without fake findings; hostile-input and
authorization tests pass; queued, error, inconclusive, trial, active and ended states are visible;
documentation matches actual permissions/formats; failures remain observable; and temporary source
retention remains zero.
