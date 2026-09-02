# Access boundaries

This file is the authorization source of truth for NoSpoilers. Product PRDs describe
what exists; this file describes **who may see or change it**.

Employee Public Footprint is a separate future application. It is not built in this
repository and has no role here.

## Roles

### Public Visitor

Unauthenticated browser traffic.

**May**

- View Product, Pricing, documentation (`/docs`), Privacy, Terms, Retention, Disclosure, Support, Refunds, and the public Status page (`/status`).
- Open Watch and Scan marketing/preview layouts (`?as=trial`, `?as=ended`).
- Use the local pack drop zone (`POST /api/scan`) within hard size limits.
- Verify a signed receipt JSON they already have (`POST /api/receipts/verify`) against this instance’s HMAC key. The Scan page hashes an optional pack in the browser and does not upload those bytes. Coverage ended still allows this check. Authentic failed-policy or inconclusive is not a passing result.
- Hit `/api/health` and `/api/ready` (no connection strings, no tenant data).
- Call GitHub App webhooks with a valid HMAC.

**Must not**

- Read another customer’s repositories, alerts, jobs, billing, or scan receipts.
- Open Artifact Leads, Disclosure Desk, prospect records, global queues, or cost data.
- Start unbounded hosted unpack work.
- Call `POST /api/v1/scan` without a valid, unrevoked scan API token for an installation
  that still has coverage.
- Read another customer’s release revisions.

### Customer Member

A GitHub user signed into NoSpoilers who belongs to an installation they are allowed to use.

**May**

- See Watch data for the GitHub installation they select. List APIs accept
  `?installationId=`; an id they do not belong to returns empty, not another tenant.
  Writes that create install-scoped records require an explicit installation when the
  user belongs to more than one. Coverage and GitHub suspend are enforced on that
  install, not on a sibling org.
- Connect and watch public npm packages on those installations while coverage is active.
  `latest` unpacks, and `next`/`beta`/`canary` (plus rc/alpha/preview, cap three extras)
  unpack when those tags point at another version. Other dist-tags are a tag-only alert.
- Connect and watch public HTTPS production websites on those installations while coverage is
  active. The crawler fetches the named page, then same-origin JavaScript, CSS, maps, and a
  bounded probe of exposed files, credentials, and internal paths linked from the page.
  Local, private, and metadata hosts are blocked. JavaScript is not executed. Unwatch requires
  typing the origin URL. Unpaid returns 402. Another tenant’s origin is 404 or empty.
- List Sentry/Bugsnag map custody hosts on a covered install (tokens are never returned). Check
  now enqueues a lookup of stored debug IDs or release names. Solo paid is allowed. Unpaid
  returns 402. Another tenant’s destination is empty. Bugsnag matches a release version; it
  cannot look up a debug ID.
- Protect a watched npm package’s identity after the npm scope or GitHub repository field
  matches this GitHub install. Naming an arbitrary pack is not ownership. Maintainer,
  repository, homepage, and artifact-shape changes append snapshots and explainable alerts.
- On a trial or Team install, list bounded lookalike candidate names for a protected pack.
  Metadata-only registry checks (never download or execute lookalike tarballs). A new
  dependency on a package first published within 14 days is a Watch alert (metadata
  `time.created` only; the added pack is not downloaded). Solo paid
  returns 403. Unpaid returns 402. Another tenant’s package is 404. Alerts are facts, not a
  malware verdict, and never auto-advisory or takedown.
- Watch packs from private HTTPS registries already saved on those installations. Token
  values are never returned.
- Trigger a latest-release scan on those repositories while coverage is active. That scan
  unpacks the repo’s current GitHub Release pack, not the git tree, and is not the hourly
  visibility poller. Anonymous is 401, unknown repo 404, another tenant 403, unpaid 402.
  GitHub `release.published` and later pack-asset edits enqueue the same hosted unpack;
  unpublishing or deleting a release is an alert only.
- Read the packed-artifact setup workflow, vendored hosted-scan Action, and the remediation
  file bundle on those repositories. Opening the reviewable PRs is an install admin action.
- Read signed scan receipts for those installations and diff against an approved baseline
  (or the last two receipts if none is approved). SIZE-003 is a warning on a 2× or ≥5 MiB
  unpacked jump versus that comparison; it stores byte counts, not source.
- View their own coverage status.
- See GitHub App suspend, unsuspend, permission-change, and repository add/remove
  alerts on installations they belong to. Uninstall drops the tenant; there is no
  Watch surface left for an uninstall notice.
- List recent jobs for those installations (kind, status, attempts, error, timestamps).
  Payloads, prospect scans, and other tenants are not included. Jobs cannot be patched
  or deleted by customers. Done and failed jobs older than the install list window are
  hidden; queued and running jobs stay visible. Counts are not a remaining-scan credit
  meter. Hosted unpacks are capped by concurrent jobs per install (Solo one, Team/trial
  three) and by a daily fair-use budget (Solo 8, Team/trial 24 heavy unpacks per UTC
  day). Watch may show warning or paused-until-UTC-midnight copy. It does not show
  remaining credits or buy-more. `GET /api/jobs` may include `fairUse` with
  `warning`, `exhausted`, and `resetsAt` only.
- Read this install’s retention window (90, 180, 365 days, or keep while this install
  exists). Default is 90 days. GET is not Team-gated. Unpaid installs may read. Another
  tenant’s installation returns the default 90-day window, not that tenant’s setting.
  Alert, job, delivery, receipt, revision, audit, and Team timeline lists honor that
  window. Direct alert, receipt, and revision ids still load for incident work.
- Run a live GitHub permission test on installations they belong to. The test never
  inserts an alert and never claims a security incident. It reports Contents/Metadata
  reads, Members read (collaborator alerts), optional Contents/Pull requests/Checks write,
  whether Administration was granted (it should not be), App-requested permissions this
  install has not accepted (with a link to GitHub’s Accept page; never Administration),
  a repo probe, and the last customer job (kind, status, time) for that install, or that
  none exist. Missing Members read or optional writes do not fail the test. It stays
  available when coverage has ended or GitHub has suspended the App.
- Acknowledge, assign (to a GitHub login on that install), resolve with a note, and
  reopen alerts on installations they belong to. Incident state stays available when
  coverage has ended or GitHub has suspended the App. Alert events are append-only.
  They may export that same activity as JSON for their installs.
- Read the current hosted scan origin when signed in, to set repository variable
  `NOSPOILERS_API_URL` for Setup CI. Anonymous `/api/me` does not include it. GitHub-hosted
  runners cannot reach loopback or HTTP. The origin is `APP_BASE_URL`, not a connection string.
- Use a scan API token an install admin already minted. `POST /api/v1/scan` with that
  Bearer token unpacks a packed artifact, applies the installation allowlist, mints a
  receipt, and deletes the bytes.
- List append-only release revisions for those installations (channel, digests, source
  revision, stored CI run URL, linked receipt status). Failed-policy and inconclusive are
  not a passing result. Historical rows cannot be edited or deleted. Download the
  linked signed receipt JSON (`GET /api/receipts/:id`). Unpaid still allowed. Another tenant
  is 404. Pack bytes are not included.
- List Slack, SIEM, and Jira destination hosts on a trial or Team install (URLs, emails, and
  tokens are never returned). Jira lists the project key. A delivery test talks to the
  destination and never inserts an alert. A Jira test never creates a ticket. List routing
  rules for those destinations. A routed test talks to matching destinations and never
  inserts an alert.
- Read this install’s 90-day timeline (alerts, acknowledgement activity, and notification
  deliveries) on a trial or Team install. Solo paid returns 403. Unpaid returns 402.
  Another tenant’s installation is empty. Titles only; webhook URLs and secret values
  are not included.
- Read and export this install’s Team audit log (admin writes, notification deliveries,
  and alert titles) on a trial or Team install. Solo paid returns 403. Unpaid returns 402.
  Another tenant’s installation is empty. Webhook URLs, emails, tokens, ciphertext, and
  alert bodies are not included. Members may read/export; only admins create entries.
- List people on this install (GitHub login and admin/member role) and pending GitHub-login
  invites. Other tenants are empty.

**Must not**

- Link an arbitrary GitHub installation ID they do not own. Setup verifies the signed-in
  user owns that install on this App.
- Change roles, remove members, invite or revoke a GitHub login, save or delete Slack/SIEM/Jira destinations or routes, save or delete private
  registry tokens, mint or revoke scan API tokens, manage allowlists or baselines, allowlist or revoke
  lookalike names, change the retention window, save or delete Sentry/Bugsnag map custody, open setup or
  remediation PRs, or confirm make-private / delete pack assets / disable workflow. Those writes need an
  install admin.
- Delete append-only evidence by shortening retention. Alert events, notification deliveries,
  audit events, identity snapshots, release revisions, and scan receipts are not deleted;
  lists hide older rows at query time.
- See other tenants’ registry tokens, Slack, SIEM, or Jira destinations, map custody tokens, watched websites, scan API tokens, ciphertext, alerts, repos, jobs, artifacts, scan receipts, or release revisions.
- Edit or delete scan receipts, release revisions, jobs, alert events, or audit events. Receipts, revisions, alert events, and audit events are append-only; the customer job list is read-only.
- Patch alert titles or bodies. Resolve with a note instead.
- Assign an alert to a GitHub login that is not a member of that installation.
- Access `/internal/*` or `/api/internal/*`.
- Read prospect companies, disclosure records, campaigns, global jobs, or infrastructure costs.
- See a remaining-scan credit balance, “N remaining”, or buy-more copy. Daily hosted
  unpacks are fair use, not a credit meter.

### Customer Administrator

A member who can manage the customer’s GitHub installation membership and product settings
on a trial or Team install. The first GitHub user to connect an install is admin; later
users become members. Solo paid returns 403 for role changes and invites. Unpaid returns 402. GitHub
suspend does not block role changes or GitHub-login invites. Email invite waits on Resend.

This is not GitHub App **Administration**. That GitHub permission is repo-admin (make the
repository private, delete Release assets, disable workflows, change settings). It is not
granted. Contents write is enough to seed the throwaway fixture and open reviewable PRs.

**May**

- Promote, demote, and remove people on that install. The last admin cannot be demoted
  or removed (409). Role changes and member removal require typing that GitHub login.
- Invite a GitHub login on a trial or Team install. Typed confirm is that login. They get
  that role the next time they sign in, if GitHub already lists them on this App install.
  Pending invites are listed on Watch. Revoke requires typing the stored login. Does not
  send email. Does not auto-link someone GitHub did not list. Does not grant GitHub
  Administration. If applying a member invite would leave zero admins, they stay admin and
  the invite is consumed. Upserts a pending invite when the login is not yet a member (409
  if they already are).
- Save and delete encrypted Slack incoming webhooks, SIEM HTTPS webhooks, and Jira Cloud
  destinations on a trial or Team install. URLs, emails, and API tokens are never returned
  after save. Deletes require typing the destination host. Jira is `*.atlassian.net` only (site name, host, or https URL). Private, local,
  metadata, and Slack hosts are rejected for SIEM, and DNS must resolve to a public address
  before POST. Jira tests GET `/rest/api/3/myself` and `/rest/api/3/project/{key}` and never
  POST `/issue`.
- Save and delete alert routes (min severity, repository, package, teammate assign, destination)
  on a trial or Team install. Destinations without a route still receive every Watch alert.
  A routed test never inserts an alert and never auto-assigns. Route deletes require typing
  the destination host.
- Save encrypted private npm registry tokens (never returned after save). Registry deletes
  require typing the origin.
- Save and delete encrypted Sentry or Bugsnag map custody on a covered install. Tokens are
  never returned. Deletes require typing the destination host. Solo paid is allowed. Unpaid
  returns 402. Custom hosts are DNS-checked for SSRF before lookup. The worker never
  downloads map `sourcesContent`.
- Mint and revoke hashed scan API tokens. The secret is shown once and never stored. Revoke
  requires typing the token name.
- Manage expiring allowlist exceptions and approve scan baselines. Revoke requires typing
  the rule. Unwatch requires typing the package name.
- Open a reviewable setup PR or remediation PR while coverage is active. The App never
  merges those PRs. Required Contents write and Pull requests write are shown before the
  button. Existing customer ignore/policy/workflow/Action files are not overwritten. Those PRs are
  not make-private, asset deletion, or workflow disable.
- Confirm one-click make-private (type `owner/repo`), delete packed assets on the latest
  GitHub Release (type `delete pack assets on owner/repo`), or disable a workflow under
  `.github/workflows/` (type that path; not `.github/workflows/nospoilers.yml`). Unpaid
  returns 402. GitHub suspend returns 409. Members return 403. Missing GitHub App
  Administration returns 409 with GitHub UI steps. Contents write is not enough. Do not
  grant Administration for Phase 1. A successful response writes audit plus a Watch alert
  that is a confirmed action, not a discovered incident.
- Allowlist or revoke a lookalike candidate on a protected pack (reason required; type the
  candidate name). Audit entries record the public package and candidate names only.
- Change this install’s list retention to 90, 180, or 365 days, or keep while this install
  exists. Type `90`, `180`, `365`, or `keep`. Solo paid is allowed. Unpaid returns 402.
  GitHub suspend does not block. Audit summaries are public only. Append-only evidence is
  never deleted.

**Must not**

- Anything on the internal operator list below.
- Demote or remove the last admin.
- Send email, or link a GitHub login that GitHub has not listed on this App install.

### Billing Administrator

A member who can change plan, payment method, and invoices. **Planned** with Stripe.

**May (when built)**

- Start Checkout, open Billing Portal, see invoices for their billing account.

**Must not**

- See other customers’ Stripe objects or NoSpoilers revenue totals.
- Toggle coverage for installations they do not administer.

### NoSpoilers Operator

Internal staff running acquisition and disclosure work.

**May**

- Use Artifact Leads / Disclosure Desk for **public** artifacts only.
- Queue one prospect scan at a time, behind customer jobs.
- Record outreach state. Never send mail without a later human-confirm step.

**Must not**

- Browse customer source, credential values, or packed bytes (we do not store those).
- Change another customer’s billing or GitHub installation.
- Export cross-customer datasets for research without anonymization review.

**Current implementation:** Operator is not a separate login. Use Owner credentials
(`ADMIN_TOKEN` or `ADMIN_GITHUB_LOGIN`) until a narrower operator grant exists.

### NoSpoilers Owner

The product owner (GitHub login `EmotiveImpact` unless `ADMIN_GITHUB_LOGIN` is changed).

**May**

- Everything an Operator may do.
- Hold `ADMIN_TOKEN`, GitHub App PEM, Neon, Stripe, and infrastructure secrets.
- See global queue depth, failed-job counts, and daily hosted-unpack aggregates at
  `GET /api/internal/queue` (shown on Artifact Leads). Counts only: no payloads, tenant
  names, remaining-credit UI, or credential values. Usage fields are
  `customerHeavyToday`, `installsWarning`, and `installsExhausted`.
- Change production configuration.

**Must not**

- Keep customer source or secret values in notes, tickets, or the database.
- Publish prospect lists or name companies from Artifact Leads.

## Surfaces that are owner-only

These are never customer features:

| Surface | Route / data |
| --- | --- |
| Artifact Leads | `/internal/prospects`, `/api/internal/prospects*` |
| Disclosure Desk | future internal routes extending Artifact Leads |
| Prospect companies and artifacts | `prospects` table |
| Disclosure records and campaigns | not built; will be internal-only |
| Global job/queue operations | `GET /api/internal/queue` counts on Artifact Leads; job bodies are not listed; usage aggregates are counts only |
| Infrastructure costs | billing of *our* cloud, not customer invoices |
| Cross-tenant support views | not built; will be owner-only |

- Arbitrary installation-ID linking is rejected unless GitHub says that user owns this App install.
- Hosted jobs, alerts, release scans, the visibility poller, scan-token minting, setup and
  remediation PRs, and `POST /api/v1/scan` run only while that installation’s billing account
  is on trial or a paid plan **and** GitHub has not suspended the App. Unpaid installs still
  get webhook HTTP 200. GitHub suspend is not a billing change: coverage stays on the
  trial/plan, Watch shows the suspend, and GitHub-backed unpack and PR writes return 409
  until unsuspend. Live permission tests and alert acknowledgement/assignment/resolution
  are not unpack work and stay available. Anonymous `POST /api/scan` stays a size-limited
  acquisition surface.
- Sign-in (`/api/auth/github` and the OAuth callback) and owner Artifact Leads
  discover/inspect/rescan are rate-limited per address after the relevant auth check.
  Anonymous 401s do not consume the discovery budget. GitHub webhooks are not rate-limited.
- GitHub `github_app_authorization` with `action: revoked` deletes that user’s sessions and
  discards the stored GitHub OAuth token. HMAC is still required. The GitHub installation is
  not deleted. Coverage does not gate this. Other users on the same install keep their sessions.
  Sign-out deletes only the current session cookie’s row.
- GitHub `installation_target` with `action: renamed` updates that installation’s stored
  account login in place. HMAC is still required. No job, no alert, no worker wake. Unpaid
  installs still update so Watch lists the current GitHub name. Unknown installs are a no-op
  (no billing row is created). Coverage does not gate this.

## How access is checked today

1. **Public / customer APIs** — signed session cookie `ns_session` where required.
2. **Internal APIs** — `Authorization: Bearer $ADMIN_TOKEN`, `x-admin-token`, **or** a
   session whose GitHub login matches `ADMIN_GITHUB_LOGIN` (default `EmotiveImpact`).
3. Health reports `database.mode` as `neon`, `postgres`, or `pglite` and never the URL.
   `/status` renders that same public liveness payload.

## Tests

`tests/prospects.test.ts` proves anonymous and ordinary customer sessions cannot list or
mutate Artifact Leads, cannot read `/api/internal/queue`, and that owner queue JSON is
counts only (no payloads, URLs, credential values, or tenant names), including daily
unpack aggregates. `tests/receipts.test.ts` proves customers cannot read another
tenant’s receipts, receipts cannot be patched, and SIZE-003 mints on a 2× unpacked jump
(not the first scan, not inconclusive, suppressible by allowlist) without storing source. `tests/policy.test.ts` proves
allowlist entries are tenant-scoped, unpaid writes return 402, revoke does not DELETE
the row, unrelated rules stay unsuppressed, and Release Diff uses the approved baseline.
`tests/setup-pr.test.ts` proves setup-PR files are tenant-scoped, unpaid POST returns 402,
permission skips return copy-paste files instead of failing the worker, the merge API
is never called, the generated workflow vendors `.github/actions/nospoilers` instead of
`uses:` on this private repository, and the workflow lists only existing `package.tgz` / `dist/` packs
(skips source-tree tarballs and symlinks, caps at 8, fails closed when none exist).
`tests/hosted-origin.test.ts` proves signed-in `/api/me` and setup-workflow return `APP_BASE_URL`
as the hosted scan origin, anonymous `/api/me` omits it, and loopback/HTTP is not reachable from
GitHub-hosted runners. `tests/remediation.test.ts` proves remediation files are tenant-scoped,
unpaid POST returns 402, GitHub-suspended POST returns 409, permission skips return
copy-paste files, required permissions are listed before write, customer ignore/policy
files are not overwritten, empty `.nospoilers.yml` has no allowlist, and the merge API
is never called. `tests/npm-watch.test.ts` proves private registry tokens are encrypted,
never returned, blocked off-tenant, and never written onto jobs, and that next/beta/canary
tarballs enqueue as `npm_scan` while custom dist-tags stay tag-only. `tests/scan-api.test.ts`
proves scan API tokens are hashed, shown once, tenant-scoped, unpaid mint/scan return 402,
and revoked tokens cannot unpack. `tests/release-ledger.test.ts` proves release revisions
are append-only, tenant-scoped, flag digest mismatch without a compromise claim, reject
SSRF CI URLs, keep older HMAC receipts verifiable, and return the signed receipt JSON for
a sealed release even after coverage ends (another tenant is 404). `tests/package-identity.test.ts`
proves arbitrary npm names cannot be protected, identity snapshots are append-only,
maintainer/repository/shape alerts never store emails or issue a malware verdict, lookalike
generation is deterministic and capped, candidate APIs are tenant-scoped (Solo 403, unpaid
  402), registration/version/dormant/burst/jump/new-dependency alerts never download lookalike
  or dependency tarballs or claim malware, and allowlisting skips further lookalike alerts.
`tests/install-health.test.ts` proves GitHub suspend/unsuspend/permission/repo-change
alerts are tenant-scoped and coverage-gated, uninstall drops the tenant, `/api/jobs`
never returns payloads or prospect scans, other tenants cannot read those jobs, and
the summary is queued/running/done/failed counts with no scan-credit field, and `fairUse`
is warning/exhausted/resetsAt only.
`tests/usage.test.ts` proves Solo is 8 heavy hosted unpacks per UTC day, Team/trial 24,
the ninth webhook stays HTTP 200 with no extra job, one `fair_use_budget` alert per install
per UTC day, light jobs and prospect scans do not consume the cap, Scan latest and
`POST /api/v1/scan` return 429 + Retry-After when exhausted, unpaid Scan latest stays 402,
`/api/jobs` has no remaining-credit field, and owner queue usage is aggregate counts
without tenant names.
`tests/hosted.test.ts` proves Solo is capped to one concurrent heavy unpack, Team gets
three, another tenant is not stuck behind a Solo queue, and the global heavy cap still
applies. The same file proves GitHub `release.edited` rescans only when pack assets change,
title-only edits and non-pack assets do not enqueue, assets attached after publish enqueue a
second scan, `unpublished`/`deleted` are light jobs that alert without downloading, `repository.deleted`
removes the Watch row instead of resurrecting it, `renamed` updates the stored name,
`member` added / `fork` / cheap `push` (`*.map` / `.env` only) enqueue light jobs and the worker
writes Watch alerts (other member actions and non-matching pushes do not; HMAC required; unpaid is
HTTP 200 with no job), the GitHub `public` event queues the same publicized job,
`repository.privatized` updates the Watch row without a job, and
`github_app_authorization` revoked drops that user’s sessions and stored OAuth token without
enqueueing work or deleting the install (HMAC still required; unpaid coverage does not skip it).
`installation_target` renamed updates the stored account login without a job (HMAC required;
unpaid still updates; unknown installs do not create a tenant). `tests/release-ledger.test.ts`
proves listed and fetched releases include linked receipt status from `scan_receipts` (not an
`ok` column), dirty packs are `failed-policy` not passed, unpaid GET still returns status, and
another tenant is 404. `tests/receipts.test.ts` also
proves anonymous `POST /api/receipts/verify` does not consume the hosted unpack budget, does
not call a failed-policy receipt clean, and never requires a session.
`tests/incident-response.test.ts` proves live permission tests never insert an alert,
never ask the customer to Accept Administration, name App-requested permissions the
install has not accepted, alert acknowledgement/assignment/resolution is tenant-scoped,
off-install assignees are rejected, unpaid and GitHub-suspended installs can still
acknowledge and test, `alert_events` cannot be updated or deleted, and activity export
is tenant-scoped.
`tests/multi-org.test.ts` proves one user with two GitHub installs sees each org’s
repos/alerts/jobs only when `installationId` is set, another tenant’s id is empty,
writes without an install id return 400 when two installs exist, unpaid or GitHub-
suspended coverage on one org does not lock a sibling trial org, last-delivery on
the permission test comes from a real customer job and never inserts an alert, and
`/api/health` still omits `DATABASE_URL` and tenant data.
`tests/notifications.test.ts` proves Slack incoming webhooks are encrypted, never returned,
tenant-scoped, unpaid saves return 402, Solo paid returns 403, a delivery test never inserts
an alert, real alerts POST after insert, and `notification_deliveries` are append-only.
The same file proves SIEM HTTPS webhooks follow those rules, reject private/local/Slack
hosts, skip fetch when DNS resolves private, never return the URL or query token, and
POST JSON with `inventedIncident: false`.
The same file proves Jira Cloud destinations encrypt email+token, never return them, reject
non-`*.atlassian.net` hosts, skip fetch when DNS resolves private, test with GET myself+project
(never POST `/issue`, never insert an alert), and real alerts POST `/rest/api/3/issue`.
The same file proves Team routing rules are tenant-scoped, unpaid saves return 402, Solo paid
returns 403, a routed test never inserts an alert, destinations without a route still receive
every alert, critical-only routes skip info scans, and a matching teammate is assigned on a
real alert.
`tests/timeline.test.ts` proves the 90-day timeline is tenant-scoped, drops rows older than
90 days, returns 403 for Solo and 402 when unpaid, and does not invent incidents.
`tests/retention.test.ts` proves the list window defaults to 90 days, hides older alerts
without DELETE, honors 180/365/keep, requires typed confirmation, allows Solo writes,
returns 402 when unpaid, returns 403 for members and other tenants, and that append-only
`alert_events`, `notification_deliveries`, and `audit_events` still reject DELETE.
`tests/audit.test.ts` proves the Team audit log is tenant-scoped, Solo 403, unpaid 402,
typed confirmation is required for destructive deletes, export never includes webhook URLs
or alert bodies, members can read/export, and `audit_events` cannot be updated or deleted.
`tests/roles.test.ts` proves the first linked user is admin and later users are members,
members can watch and test but cannot save Slack/SIEM/Jira, map custody, routes, registries, scan tokens, allowlists,
or open setup/remediation PRs, role changes are trial/Team only (Solo 403, unpaid 402),
GitHub suspend does not block role changes, and the last admin cannot be demoted or removed.
`tests/github-response.test.ts` proves make-private, delete-pack-assets, and disable-workflow
are install-admin only, require typed confirmation, 409 until Administration without audit,
refuse `.github/workflows/nospoilers.yml`, hide other tenants, unpaid GET is allowed, unpaid
POST is 402, GitHub suspend is 409, and a mocked Administration write records audit plus a
Watch alert that is a confirmed response, not a discovered incident.
`tests/web-origin.test.ts` proves website watches are tenant-scoped, unpaid POST returns 402,
SSRF skips fetch, unwatch audit stores the host only, exposed `.env` and `.git` files alert
without storing secret values, SPA catch-all HTML is not treated as a secret file, and
off-origin credential hrefs are not fetched.
`tests/map-custody.test.ts` proves Sentry/Bugsnag tokens are encrypted, never returned, never
written onto jobs, tenant-scoped, unpaid saves return 402, members cannot save, Solo paid may
save, private DNS skips fetch, missing private artifacts flag MAP-011, public maps flag MAP-012,
and Bugsnag without a release is inconclusive (debug ID lookup is not available).
`tests/secrets.test.ts` proves hosted `/api/scan`, GitHub OAuth start, and owner discovery
return 429 after the configured cap, that anonymous 401s do not consume the discovery budget,
and that GitHub webhooks are not rate-limited. `tests/docs.test.ts` proves `/docs` states we
never execute packages or retain source, Stripe is not live, and Electron stays later.
Keep those tests green when adding internal routes.
