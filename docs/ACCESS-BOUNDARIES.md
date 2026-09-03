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
- Verify a signed receipt JSON they already have (`POST /api/receipts/verify`) against this instance’s HMAC key. The Scan page hashes an optional pack in the browser and does not upload those bytes. The CLI (`nospoilers verify --receipt`) can re-hash a local file or stream-hash a `--url` with the same hop/SSRF rules as Watch; that does not call Watch and does not need coverage. Coverage ended still allows the Scan check. Authentic failed-policy or inconclusive is not a passing result.
- Hit `/api/health` and `/api/ready` (no connection strings, no tenant data). Health may
  include `role` (`all` / `web` / `worker`) and `ui` (whether a built SPA is on disk).
- View a customer-published verification page (`/verify/:token` and `GET /api/verify/:token`) when that page is enabled. Digests, receipt status, delivery hostnames, and last match only. Query strings, pack bytes, CI URLs, signed URLs, and unpublished revisions are omitted. Failed-policy and inconclusive are not a clean result. The read does not enqueue a delivery download.
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
  A later registry 404 after a recorded version is a Watch alert (`package_unpublished`)
  without a download. A registry 5xx or network error is not. Unpaid skips the alert.
  Another tenant cannot see it.
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
  matches this GitHub install.   Naming an arbitrary pack is not ownership. Maintainer,
  repository, homepage, artifact-shape, and publishing-identity (`_npmUser.name` /
  trusted publisher id) changes append snapshots and explainable alerts. Email and
  OIDC config ids are not stored. First snapshot and empty previous publisher do
  not alert. Solo paid is allowed. Unpaid skips.
- Import a batch of npm names (`POST /api/protections/import`, cap 20) and protect the
  ones this install owns. Registry metadata only — no tarball download and no `npm_scan`
  job. Names that are not owned, not on the registry, or invalid are not added to the
  watch list. Already protected names stay as they are. A new owned name is watched only
  when this install is under the 25-package watch cap. Solo paid is allowed. Unpaid
  returns 402. Another tenant is 403. Unauthenticated is 401.
- On a trial or Team install, list bounded lookalike candidate names for a protected pack.
  Metadata-only registry checks (never download or execute lookalike tarballs). Public
  packument metadata, including 404s, is cached for one hour per process. Private-registry
  tokens bypass the cache. Watch Check now, connect, protect, and import fetch the watched
  name fresh. The hourly poller skips lookalike candidates checked within the last hour
  (eight per pass). Never-checked names stay due. A new
  dependency on a package first published within 14 days is a Watch alert (metadata
  `time.created` only; the added pack is not downloaded). A packument `dist.unpackedSize`
  that is 2× or ≥5 MiB versus the last identity snapshot is a Watch alert (claimed size
  only; no download). Losing npm packument attestations, a provenance predicateType
  change, or a registry signature keyid change is a Watch alert (presence only; the
  attestation URL is not fetched; signature values are not stored or verified). First
  snapshot and missing size do not alert. On the same trial or Team install, read a
  deterministic 0–100 identity signal total for that protected pack (`GET /api/packages/:id/identity`
  `risk`). The total is decomposed into current snapshot facts, registered non-allowlisted
  lookalikes, and open burst / lookalike-version / new-dependency / unpublished alerts. Solo
  paid and unpaid still return identity snapshots with `risk: null`. Another tenant’s package
  is 404. The risk GET does not fetch the registry. Alerts are facts, not a malware verdict, and never auto-advisory or takedown.
- On a trial or Team install, read assembled identity evidence for a protected pack on
  that install. Members may download the JSON. Unpublished or missing packs return
  `evidence: null`. Solo paid returns 403. Unpaid returns 402. Another tenant’s package
  is 404. The public advisory token 404s when disabled.
- On a trial or Team install, read the npm scope watchlist that matches this GitHub
  login and enqueue a metadata-only check. Members may read and check. Solo paid
  returns 403. Unpaid returns 402. Another tenant’s list is empty. New names are a
  Watch fact. Tarballs are not downloaded and names are not auto-watched.
- Watch packs from private HTTPS registries already saved on those installations. Token
  values are never returned.
- Trigger a latest-release scan on those repositories while coverage is active. That scan
  unpacks the repo’s current GitHub Release pack, not the git tree, and is not the hourly
  visibility poller. Anonymous is 401, unknown repo 404, another tenant 403, unpaid 402.
  GitHub `release.published` and later pack-asset edits enqueue the same hosted unpack;
  unpublishing or deleting a release is an alert only.
- Read the packed-artifact setup workflow, vendored hosted-scan Action, and the remediation
  file bundle on those repositories. Opening the reviewable PRs is an install admin action.
- Probe Setup status on those repositories: whether the vendored Action and workflow YAML
  exist on the default branch or `nospoilers/setup`, and whether a NoSpoilers check ran on
  the default SHA. Never invents an alert. Cannot see or set branch protection or a
  required check. Unpaid still allowed. Another tenant is 403.
- Read signed scan receipts for those installations and diff against an approved baseline
  (or the last two receipts if none is approved). SIZE-003 is a warning on a 2× or ≥5 MiB
  unpacked jump versus that comparison; it stores byte counts, not source.
- See whether a sealed revision on those installations has a published verification page
  and its `/verify/:token` path. Members cannot publish or unpublish. Unpublished tokens
  404. Another tenant is 404.
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
  revision, stored CI run URL, linked receipt status, attached delivery URLs with query
  strings redacted, latest approval, legal-hold status, and latest GitHub/npm attestation
  facts on a trial or Team install). Failed-policy and inconclusive are
  not a passing result. Historical rows cannot be edited or deleted. Download the
  linked signed receipt JSON (`GET /api/receipts/:id`). Unpaid still allowed. Another tenant
  is 404. Pack bytes are not included. Delivery verification, approval, legal-hold,
  and attestation rows are append-only. A revision on legal hold stays on the list after the retention
  window. Direct revision ids still load for incident work. Members on a trial or Team
  install may `GET /api/releases/:id/attestations`. Solo paid returns 403. Unpaid
  returns 402. Signature bytes and bundles are never returned. This is not a Sigstore
  verdict.
- On a trial or Team install, export the release ledger JSON (digests, size, media type,
  receipt status, approvals, hold events, redacted delivery URLs). Members may export.
  Solo paid returns 403. Unpaid returns 402. Another tenant’s installation is empty.
  Query strings, pack bytes, and receipt bodies are not included.
- List Slack, SIEM, Jira, and PagerDuty destination hosts on a trial or Team install (URLs,
  emails, tokens, and routing keys are never returned). List one email destination on a
  covered install (domain + redacted local; the mailbox is never returned). Jira lists the
  project key. PagerDuty lists `events.pagerduty.com`. A delivery test talks to the
  destination and never inserts an alert. An email test never invents a Watch alert. A Jira
  test never creates a ticket. A PagerDuty test POSTs a change event and never creates an
  incident. Email test and send stay 503 until Resend keys exist. List routing rules for
  those destinations. A routed test talks to matching destinations and never inserts an
  alert.
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
- Change roles, remove members, invite or revoke a GitHub login, save or delete email/Slack/SIEM/Jira/PagerDuty destinations or routes, save or delete private
  registry tokens, mint or revoke scan API tokens, manage allowlists or baselines, allowlist or revoke
  lookalike names, watch or stop watching an npm scope, assemble identity evidence or publish a consumer advisory, change the retention window, save or delete Sentry/Bugsnag map custody, attach or
  verify a release delivery URL, publish or unpublish a verification page, refresh GitHub or npm attestations, approve or reject a sealed revision, place or release a legal hold, open setup or
  remediation PRs, or confirm make-private / delete pack assets / disable workflow. Those writes need an
  install admin.
- Delete append-only evidence by shortening retention. Alert events, notification deliveries,
  audit events, identity snapshots, release revisions, and scan receipts are not deleted;
  lists hide older rows at query time.
- See other tenants’ registry tokens, email, Slack, SIEM, Jira, or PagerDuty destinations, map custody tokens, watched websites, scan API tokens, ciphertext, alerts, repos, jobs, artifacts, scan receipts, release revisions, or delivery URLs.
- Edit or delete scan receipts, release revisions, release approvals, legal-hold events, release attestations, jobs, alert events, or audit events. Receipts, revisions, approvals, holds, attestation facts, alert events, and audit events are append-only; the customer job list is read-only.
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
suspend does not block role changes or GitHub-login invites. Invites stay GitHub-login only and never send mail.

This is not GitHub App **Administration**. That GitHub permission is repo-admin (make the
repository private, delete Release assets, disable workflows, change settings). It is not
granted. Contents write seeds the throwaway fixture (not Actions YAML). Opening a
reviewable setup or remediation PR also needs Pull requests write. The App never merges.

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
- Save and delete one encrypted Watch email destination on a covered install (trial, Solo,
  or Team). Unpaid returns 402. The full address is encrypted and never returned. The API
  lists the domain and a redacted local part. Audit `target_id` is the domain only. Deletes
  require typing that domain. Test and send stay 503 until `RESEND_API_KEY` and
  `RESEND_FROM_EMAIL` are set. A test never invents a Watch alert and never mails a
  disclosure or invite. The from address is the host mailbox, never a customer address.
- Save and delete encrypted Slack incoming webhooks, SIEM HTTPS webhooks, Jira Cloud
  destinations, and PagerDuty Events API routing keys on a trial or Team install. URLs,
  emails, API tokens, and routing keys are never returned after save. Deletes require typing
  the destination host. Delivery rows stay and drop the destination id. Jira is `*.atlassian.net` only (site name, host, or https URL).
  PagerDuty is `events.pagerduty.com` only. Private, local, metadata, and Slack hosts are
  rejected for SIEM, and DNS must resolve to a public address before POST. Jira tests GET
  `/rest/api/3/myself` and `/rest/api/3/project/{key}` and never POST `/issue`. PagerDuty
  tests POST `/v2/change/enqueue` and never POST `/v2/enqueue`.
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
  merges those PRs. Contents write commits the vendored Action. GitHub Actions workflow
  YAML stays copy-paste; the App does not request Workflows write. Required permissions
  are shown before the button. Existing customer ignore/policy/workflow/Action files are
  not overwritten. Those PRs are not make-private, asset deletion, or workflow disable.
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
- Attach an HTTPS delivery URL to a sealed release and verify it now. The worker
  stream-hashes the bytes, compares them to the sealed digest, and deletes the download.
  A public GitHub Release download URL and a public npm tarball URL are attached when
  that revision is sealed (no verify job, not private repos or private registries).
  Cross-host redirects are not fetched, except `github.com` to GitHub’s release-asset
  CDN hosts, same-bucket S3 path-style ↔ virtual-hosted hops, and same-account R2
  path-style ↔ virtual-hosted hops (DNS is rechecked). Arbitrary hosts, other
  buckets, CloudFront, website, accelerate, and `r2.dev` are not fetched. A
  verification stores hop hosts, a short cache token, and a region parsed from
  the host. Raw cache headers are not stored. Query
  strings are stored only to fetch and are redacted on Watch, alerts, and audit.
  Unpaid returns 402. Members return 403. Another tenant is 404. This is not the
  hourly poller and not scheduled CDN verification.
- Approve a passing sealed revision to ship, or reject it, on a trial or Team install.
  Type the coordinate. Reason required. Failed-policy, inconclusive, and digest-changed
  rows cannot be approved (409). The admin who attached a delivery URL cannot approve
  that revision (separation of duties). Duplicate same decision by the same admin is 409.
  Members return 403. Solo paid returns 403. Unpaid returns 402. Another tenant is 404.
  Audit records the coordinate only.
- Place or release a legal hold on a sealed revision on a trial or Team install. Type
  the coordinate. Reason required. The admin who placed the hold cannot release it.
  Members return 403. Solo paid returns 403. Unpaid returns 402. Another tenant is 404.
  Hold events are append-only. Audit records the coordinate only.
- Refresh GitHub and public-npm attestation documents for a sealed revision on a trial
  or Team install. Type the coordinate. The adapter stores presence, subject digest,
  predicate type, builder id, and issuer host. It does not fetch private registries,
  does not verify Sigstore, and does not store signature or bundle bytes. First refresh
  is a baseline (missing is allowed and does not alert). A later present document that
  disappears, changes predicate/builder, or mismatches the sealed digest writes a Watch
  fact. Members return 403. Solo paid returns 403. Unpaid returns 402. Another tenant
  is 404. Hosted `api:` coordinates return 400. Audit records the coordinate only.
- Publish or unpublish a verification page for a sealed revision. Type the coordinate.
  Solo paid is allowed. Unpaid returns 402. Members return 403. Another tenant is 404.
  The public token is unguessable and is not the revision id. Audit records the
  coordinate only, never the public path or token. Publishing does not enqueue a
  delivery download. Unpublish makes the public GET 404; republish keeps the same path.
  Cap 40 enabled pages per install. This is not scheduled CDN verification.
- Assemble identity evidence for a protected pack on a trial or Team install, and
  publish or unpublish its consumer advisory page. Type the package name. Members
  return 403. Solo paid returns 403. Unpaid returns 402. Another tenant is 404. The
  public token is unguessable and is not the package id. Audit records the package
  name only. Assembling does not download a tarball and does not send mail or registry
  tickets. Cap 40 enabled advisory pages per install. Not a malware verdict.
- Watch or stop watching the npm scope that matches this GitHub install login on a
  trial or Team install. Type the scope. Members return 403. Solo paid returns 403.
  Unpaid returns 402. Another tenant is 403. One scope per install. Public npm
  search only (cap 20 names). First check is a baseline. Later new names alert
  without download or `npm_scan`. Not a malware verdict. Other registries stay out.

**Must not**

- Anything on the internal operator list below.
- Demote or remove the last admin.
- Send email, or link a GitHub login that GitHub has not listed on this App install.

### Billing Administrator

The install admin is the billing administrator. A separate billing-only role is not invented.

**May**

- Start Checkout and open the Billing Portal for their installation when Stripe keys are set.
- See plan, Stripe status, and period end (never customer, subscription, or price IDs).

**Must not**

- See other customers’ Stripe objects or NoSpoilers revenue totals.
- Toggle coverage for installations they do not administer.
- Start Checkout or open the portal as a member (403).

### NoSpoilers Operator

Internal staff running acquisition and disclosure work.

**May**

- Use Artifact Leads / Disclosure Desk for **public** artifacts only.
- Queue one prospect scan at a time, behind customer jobs.
- See nested public npm workspace member names discovered from a repo workspace
  config or a scanned pack (cap 8 queued packs / 40 listed names). Members are
  not auto-watched as customer packages.
- Run the npm version feed and scheduled three-repo discover. Both skip when
  customer jobs are queued/running. The hourly poller uses the same rules.
  Save, pause, and delete GitHub search campaigns that the poller rotates.
- Record outreach state. Never send mail without a later human-confirm step.
- Open a Disclosure Desk case on an Artifact Lead: verification checklist, finding
  category (derived from fingerprints; operator can override), artifact
  URL/version/hash from the scanned lead (a new `verified` state requires the
  SHA-256; historical verified cases without a hash stay verified),
  operator-written reproducibility steps (a new `reproduced` check and a new
  `verified` state require the text; historical verified cases without steps
  stay verified), duplicate
  warning and confirmed append-only `duplicate_links` (both cases see the
  other owner/repo and reasons; a 409 without `confirmDuplicate` writes
  no row), first-class GitHub-owner organizations with append-only vendor
  domains from a stored policy URL or security contact (forge/registry hosts
  are omitted; not a commercial workspace), append-only `disclosure_findings`
  rows parsed from fingerprints (`rule|severity|path|title`, never finding
  values), encrypted expiring notes, stored (never fetched) security contact or https
  policy URL, human-edited templates, preferred vendor channel, draft preview,
  simulated acknowledgement, vendor replies, encrypted expiring attachments
  (text/PDF/image only; expired ciphertext is zeroed on desk read and the
  hourly poller), assignment, review approval, redacted JSON/HTML/PDF
  reports, internal deadline flag, conversion attribution,
  credit/CVE/outcome notes, and a fix-version rescan. `contacted` requires a verified
  case, an approved review, and is blocked when a do-not-contact entry matches
  owner/repo, package, contact, or vendor domain. A duplicate warning also appears
  before `contacted` unless `confirmDuplicate` is sent; confirming stores the
  pair once. `fixed` requires a recorded fix version and rescan.
  No message is sent. Reports omit operator notes and attachment bytes.
- Maintain owner-only disclosure templates and do-not-contact entries
  (`/api/internal/disclosure/templates`, `/api/internal/disclosure/do-not-contact`).
- Read owner-only researcher workload (`GET /api/internal/disclosure/workload`):
  case counts per assignee and unassigned, including state, pending review, and
  missed deadlines. Minutes, last-active, ranking, and billing fields are omitted.
- Read first-class Disclosure Desk organizations (`GET /api/internal/disclosure/organizations`):
  GitHub owners from cases plus recorded vendor domains, policy URLs, and
  security contacts. No create form; rows come from real cases only. Case
  GET materializes append-only finding rows from existing fingerprints.
- Save, test, and delete owner-only Disclosure Desk destinations
  (`/api/internal/disclosure/destinations`): one HTTPS webhook and one Jira Cloud
  project. Secrets are never returned. A test never invents an incident or
  creates a Jira issue. Filing a verified case posts a redacted report after
  typed coordinate confirm. Unverified cases stay 409.
- Read owner-only verified-critical and deadline-missed notifications on Artifact Leads
  (`GET /api/internal/notifications`). Unverified scans do not notify. Missed deadlines
  create an internal reminder only. Nothing is mailed.

**Must not**

- Browse customer source, credential values, or packed bytes (we do not store those).
- Change another customer’s billing or GitHub installation.
- Export cross-customer datasets for research without anonymization review.

**Current implementation:** Owner credentials (`ADMIN_TOKEN` or `ADMIN_GITHUB_LOGIN`)
are always operators. The owner can grant additional GitHub logins operator access
(`GET`/`POST`/`DELETE /api/internal/operators`, cap 8, typed login confirm). Granted
operators use Artifact Leads and Disclosure Desk. Queue counts and further grants stay
owner-only. Customer sessions stay 401. Live Neon: `051` applied; unauth and
`not-admin` 401; owner list empty; owner self-grant 400; missing confirm 400;
grant `desk-researcher` 201; typed DELETE leftover grants 0; leftover
destinations 0; no open jobs; campaigns 0; watches 0; tunnel matched.

### NoSpoilers Owner

The product owner (GitHub login `EmotiveImpact` unless `ADMIN_GITHUB_LOGIN` is changed).

**May**

- Everything an Operator may do.
- Hold `ADMIN_TOKEN`, GitHub App PEM, Neon, Stripe, and infrastructure secrets.
- See global queue depth, failed-job counts, and daily hosted-unpack aggregates at
  `GET /api/internal/queue` (shown on Artifact Leads). Counts only: no payloads, tenant
  names, remaining-credit UI, or credential values. Usage fields are
  `customerHeavyToday`, `installsWarning`, and `installsExhausted`. Granted operators
  receive 403.
- Grant and revoke operator GitHub logins (`/api/internal/operators`). Cap 8.
  Typed login confirm. The owner login cannot be granted.
- Change production configuration.

**Must not**

- Keep customer source or secret values in notes, tickets, or the database.
- Publish prospect lists or name companies from Artifact Leads.

## Surfaces that are owner-only

These are never customer features:

| Surface | Route / data |
| --- | --- |
| Artifact Leads | `/internal/prospects`, `/api/internal/prospects*`; owner or granted operator |
| Disclosure Desk | `/internal/prospects` case workflow; `/api/internal/prospects/:id/disclosure*` including replies, attachments, assign, review, and report; owner or granted operator |
| Researcher roles | `/api/internal/operators`; owner grants a GitHub login; cap 8; typed confirm |
| Disclosure templates | `/api/internal/disclosure/templates`; `disclosure_templates`; owner-only |
| Researcher workload | `/api/internal/disclosure/workload`; case counts per assignee; no time tracking |
| Disclosure destinations | `/api/internal/disclosure/destinations`; webhook + Jira; encrypted; owner-only |
| Do-not-contact | `/api/internal/disclosure/do-not-contact`; `disclosure_do_not_contact`; owner-only |
| Prospect companies and artifacts | `prospects` table |
| Disclosure records | `disclosure_cases` plus append-only `disclosure_events` and `disclosure_findings`; never customer-visible |
| Verified-critical and deadline-missed notifications | `/api/internal/notifications`; `internal_notifications`; owner-only; never mailed |
| Global job/queue operations | `GET /api/internal/queue` counts on Artifact Leads; owner-only; granted operators 403; job bodies are not listed; usage aggregates are counts only |
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
2. **Internal APIs** — `Authorization: Bearer $ADMIN_TOKEN`, `x-admin-token`, a
   session whose GitHub login matches `ADMIN_GITHUB_LOGIN` (default `EmotiveImpact`),
   **or** a session whose GitHub login has an owner-granted `operator_grants` row.
   Queue counts and operator-grant admin stay owner-only (403).
3. Health reports `database.mode` as `neon`, `postgres`, or `pglite` and never the URL.
   `/status` renders that same public liveness payload.

## Tests

`tests/internal-notifications.test.ts` proves a prospect scan with criticals does not
notify, a verified warn-only case does not notify, a verified critical case creates one
owner-only notification with rule ids and fingerprints only, a second verify is
idempotent, mark-read works, and customer sessions stay 401.
`tests/disclosure.test.ts` proves Disclosure Desk is owner-only, a signal cannot be marked
verified without the checklist, a new verified state also requires a repeatable
artifact SHA-256 and reproducibility steps, a historical verified case without a
hash or steps can stay verified,
a new case derives finding category from fingerprints
and rejects an unknown category. Live Neon: `055` applied; unauth and
`not-admin` 401; prettier and left-pad hashes and steps stay null (no
rescan/rewrite); prettier stays `fixed`/`verified`; leftover links 0;
leftover grants 0; no open jobs; tunnel matched.
`PATCH /api/internal/prospects/:id` cannot record
`contacted` before a verified case or `fixed` before a fix-version rescan, and
`contacted` also warns on a possible duplicate unless `confirmDuplicate` is sent.
Confirming stores one append-only pair; a 409 without confirm writes no row.
Live Neon: unauth and `not-admin` 401; left-pad `contacted` 409 verify;
prettier stays `fixed`/`verified`; prettier vs left-pad still no match;
leftover links 0; leftover grants 0; no open jobs; tunnel matched.
Duplicates
warn on owner/repo, same GitHub owner, vendor domain (policy URL or contact email),
package name, or fingerprint overlap unless confirmed, fingerprints
are `rule|severity|path|title` only, policy URLs are stored and never fetched, notes are
encrypted and expire from reads, drafts and acknowledgements stay `sent: false`,
`disclosure_events` are append-only, confirmed `disclosure_duplicate_links`
are append-only, vendor domains on `disclosure_organizations` stay after
contact/policy is cleared, and `disclosure_findings` stay append-only
fingerprint rows without values. Live Neon: `058` applied; unauth and
`not-admin` 401; owner desk 200; prettier findings from existing SEC-003
fingerprints; left-pad findings from its recorded fingerprints; leftover
extra findings 0; leftover extra orgs 0; leftover links 0; leftover grants
0; no open jobs; tunnel matched.
Existing feed tests still call
`store.updateProspectStatus` directly.
`tests/disclosure-phase2.test.ts` proves human-edited templates substitute placeholders
and still stay `sent: false`, do-not-contact blocks case create unless `researchOnly`
and always blocks `contacted`, vendor channel and credit/CVE/outcome notes persist,
a missed deadline creates one `deadline_missed` internal notification, and customer
sessions stay 401 on template and do-not-contact routes.
`tests/operator-grants.test.ts` proves the owner can grant a GitHub login operator
access, a granted researcher can read Artifact Leads, queue and further grants stay
403, remigrate keeps the table, customer sessions stay 401, and no worker wake.
Live Neon: `051` applied; unauth and `not-admin` 401; owner list empty; owner
self-grant 400; missing confirm 400; grant `desk-researcher` 201; typed DELETE
leftover grants 0; leftover destinations 0; no open jobs; campaigns 0; watches 0;
tunnel matched.
`tests/disclosure-destinations.test.ts` proves webhook and Jira destinations are
owner-only, secrets never return, private/Slack URLs 400, tests never invent an
incident or create a Jira issue, unverified notify is 409, a verified prettier
case files a redacted payload without notes or secret values, remigrate keeps
the table, and no worker wake. Customer sessions stay 401. Live Neon: `050`
applied; unauth and `not-admin` 401; owner list empty; localhost webhook 400;
evil Jira host 400; leftover destinations 0; no open jobs; campaigns 0;
watches 0; tunnel matched.
`tests/disclosure-workflow.test.ts` proves vendor replies and encrypted attachments
are owner-only, archives are rejected, replies and attachments are append-only,
`contacted` waits for review approval, JSON/HTML/PDF reports omit operator notes,
attachment bytes, and finding values, and researcher workload is owner-only case
counts per assignee with no time tracking and no worker wake. Live Neon:
unauth and `not-admin` 401; owner GET 200 counted EmotiveImpact’s verified
prettier case and one unassigned signal; no open jobs; tunnel matched.
`tests/disclosure-expiry.test.ts` proves expired attachment ciphertext is zeroed
and expired notes ciphertext is nulled, the row stays, unexpired ciphertext
cannot be cleared, DELETE stays rejected, remigrate keeps the empty ciphertext,
download is 410, customer sessions stay 401, and no job is enqueued. Live Neon:
`048` applied; unauth and non-admin desk GET 401; owner GET ran the sweep;
unexpired attachment ciphertext was not cleared; tunnel matched.
`tests/campaigns.test.ts` proves discovery campaigns are owner-only, typed
confirm is required, duplicate queries 409, the eighth campaign is the cap,
disabling falls back to the default scheduled query, delete leaves zero
campaigns, remigrate keeps rows, and no prospect job is enqueued. Live Neon:
`049` applied; unauth and non-admin 401; save 201; typed DELETE left 0
rows; prospect count unchanged; tunnel matched.
`tests/prospects.test.ts` proves anonymous and ordinary customer sessions cannot list or
mutate Artifact Leads, cannot read `/api/internal/queue` or `POST /api/internal/prospects/feed`,
cannot open Disclosure Desk, template, do-not-contact, workload, destination, operator-grant, or notification routes,
that owner queue JSON is
counts only (no payloads, URLs, credential values, or tenant names), including daily
unpack aggregates, that nested workspace member discovery is metadata-only (private
members skipped, cap 8, root name not duplicated, listed names stored after scan),
and that the npm version feed queues a new latest, skips same-version/404/ignored/fixed,
and yields when customer jobs are out or the prospect queue is at three. `tests/receipts.test.ts` proves customers cannot read another
tenant’s receipts, receipts cannot be patched, and SIZE-003 mints on a 2× unpacked jump
(not the first scan, not inconclusive, suppressible by allowlist) without storing source. `tests/policy.test.ts` proves
allowlist entries are tenant-scoped, unpaid writes return 402, revoke does not DELETE
the row, unrelated rules stay unsuppressed, and Release Diff uses the approved baseline.
`tests/setup-status.test.ts` proves Setup status is a signed-in Watch read (401/404/403),
unpaid still 200, members may probe, it never inserts an alert, required-check stays
unknown, and a missing GitHub file probe returns 503. `tests/setup-pr.test.ts` proves setup-PR files are tenant-scoped, unpaid POST returns 402,
permission skips return copy-paste files plus any committed branch/paths instead of failing the worker, the merge API
is never called, Contents write commits the vendored Action and skips `.github/workflows/`
unless Workflows write is present (never requested), the generated workflow vendors `.github/actions/nospoilers` instead of
`uses:` on this private repository, and the workflow lists only existing `package.tgz` / `dist/` packs
(skips source-tree tarballs and symlinks, caps at 8, fails closed when none exist).
`tests/hosted-origin.test.ts` proves signed-in `/api/me` and setup-workflow return `APP_BASE_URL`
as the hosted scan origin, anonymous `/api/me` omits it, and loopback/HTTP is not reachable from
GitHub-hosted runners. `tests/remediation.test.ts` proves remediation files are tenant-scoped,
unpaid POST returns 402, GitHub-suspended POST returns 409, permission skips return
copy-paste files, required permissions are listed before write, customer ignore/policy
files are not overwritten, empty `.nospoilers.yml` has no allowlist, and the merge API
  is never called. `tests/npm-watch.test.ts` proves private registry tokens are encrypted,
  never returned, blocked off-tenant, and never written onto jobs, that next/beta/canary
  tarballs enqueue as `npm_scan` while custom dist-tags stay tag-only, and that a registry
  404 after a recorded version writes one tenant-scoped `package_unpublished` alert without
  a download while 5xx and unpaid do not. `tests/scan-api.test.ts`
proves scan API tokens are hashed, shown once, tenant-scoped, unpaid mint/scan return 402,
and revoked tokens cannot unpack. `tests/release-ledger.test.ts` proves release revisions
are append-only, tenant-scoped, store packed size and inferred media type, flag digest mismatch without a compromise claim, reject
SSRF CI URLs, keep older HMAC receipts verifiable, and return the signed receipt JSON for
a sealed release even after coverage ends (another tenant is 404).
`tests/release-governance.test.ts` proves trial/Team approval and legal hold are
admin-only, typed-confirm, Solo 403, unpaid 402, another tenant 404, dirty and
digest-changed revisions cannot be approved, the delivery-URL attacher cannot
approve that revision, another admin must release a hold, held revisions stay
listed after the retention window, export is member-readable and redacts query
strings, and approval/hold rows are append-only.
`tests/release-public.test.ts` proves a published verification page is public when
enabled, redacts query strings / CI URLs / pack bytes, treats failed-policy as not
clean, refuses members and other tenants on publish, allows Solo, returns 402 when
unpaid while the existing page still reads, uses an unguessable token, records the
coordinate only on audit, and does not enqueue a delivery-verify job on public GET.
`tests/attestations.test.ts` proves GitHub and public-npm attestation adapters are
admin-only, typed-confirm, Solo 403, unpaid 402, another tenant 404, hosted `api:`
coordinates 400, first refresh is a no-alert baseline, later present→missing writes
`release_attestation_lost`, leftover rows stay append-only, private-registry facts
are stored as missing without a fetch, and signature bytes are never stored.
Live throwaway `phase1-fixture` revision 6 (`c74219d2…`) on Neon: unauth GET/POST
401, admin POST 201 github `missing` with no alert, leftover row 1 stayed after a
second refresh, UPDATE rejected.
Live throwaway `phase1-fixture` (`c74219d2…`) published on Neon: unauth publish
401, public GET 200 with `passingReceipt: false` and host `github.com` matched,
no query string, no new verify job; Cloudflare tunnel matched.
`tests/delivery-verify.test.ts` proves on-demand delivery URL attach/verify is
tenant-scoped, admin-only, unpaid 402, redacts query strings, stream-hashes without
storing bytes, alerts on mismatch and disappearance, follows only the GitHub
Release asset CDN hop, same-bucket S3 hops, and same-account R2 hops, records
hop hosts plus a cache token and host-derived region, does not
follow any other cross-host redirect (including CDN→S3, S3→CloudFront, and
bucket mismatch), rejects private DNS, keeps the list after coverage ends, and
attaches the public GitHub Release or public npm tarball URL when a revision is
sealed without enqueueing verify (private repos and private registries stay
unattached). `tests/package-identity.test.ts`
proves arbitrary npm names cannot be protected, identity snapshots are append-only,
maintainer/repository/shape/publisher alerts never store emails, OIDC config ids, or issue a malware verdict, lookalike
generation is deterministic and capped, candidate APIs are tenant-scoped (Solo 403, unpaid
  402), registration/version/dormant/burst/jump/new-dependency/packument-size/provenance
  alerts never download lookalike or dependency tarballs, never fetch attestation URLs,
  never store signature values or claim malware, first snapshot and missing packument size
  do not alert, publishing-identity changes are Solo-allowed facts, allowlisting skips further lookalike alerts,
  and the identity risk score is deterministic, decomposable, omitted for Solo/unpaid (`risk: null`),
  tenant-scoped, and never a malware verdict. Public packuments (including 404s) are cached
  for one hour; private-registry tokens and `{ fresh: true }` bypass that cache; the hourly
  poller skips lookalikes checked within the last hour while Watch Check now does not.
  Live Neon gates on install `158159401`:
  unauth GET 401, unknown package 404, watch list empty, namespaces 0, no open jobs; Cloudflare tunnel matched.
  Batch import (`POST /api/protections/import`) protects an owned name and snapshots
  identity, returns `not_owned` / `not_found` / `invalid` without inserting a watch,
  re-imports as `already_protected`, protects an existing watch in place, returns
  `watch_cap` at 25 watches without inserting, never downloads or enqueues `npm_scan`,
  is 401 anonymous, 403 off-tenant, and 402 unpaid. Live Neon import on install
  `158159401` refused prettier, left-pad, a missing name, and an invalid token,
  added no watches, and stayed `queued: false`; the Cloudflare tunnel matched.
  Human-reviewed evidence (`POST /api/packages/:id/evidence`, `POST /api/packages/:id/advisory`,
  `GET /api/advisory/:token`) requires a protected pack, typed confirm, and Team/trial;
  members may read; Solo 403; unpaid 402 to change; public GET is redacted hosts and
  lookalike names only; never sends; never a malware verdict; remigrate keeps
  `identity.evidence` rows. Live Neon gates: unauth GET/POST 401, missing
  package 404, unknown advisory 404, watch list empty, evidence packs 0;
  Cloudflare tunnel matched. No owned npm pack on `158159401` to assemble.
  Namespace watchlists (`POST /api/namespaces`, `GET /api/namespaces`,
  `POST /api/namespaces/:id/check`) require the npm scope to match this GitHub
  login, typed confirm, and Team/trial; members may read/check; Solo 403; unpaid
  402; other tenant 403/empty; first snapshot does not alert; a later new name
  writes `identity_namespace_new` without download or `npm_scan`; remigrate keeps
  `namespace.protect` rows. Live on install `158159401`: unauth GET/POST 401,
  unowned `@prettier` 403, then owned `@emotiveimpact` POST 201 queued a
  light `namespace_check` that finished with an empty baseline and no
  namespace alert or `npm_scan`; typed DELETE left 0 rows; Cloudflare
  tunnel matched. Do not watch prettier or left-pad on that install.
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
not call a failed-policy receipt clean, and never requires a session, and that
`nospoilers verify --url` stream-hashes a delivery URL against a receipt without
printing query strings or storing bytes.
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
`tests/email.test.ts` proves Watch email destinations encrypt the address, never return the
mailbox, allow Solo paid, return 402 when unpaid, return 403 for members and other tenants,
return 401 when signed out, record domain + redacted local, keep audit off the mailbox,
return 503 with `inventedIncident: false` until Resend keys exist, and POST to Resend for
a real alert or delivery test only when keys are set.
`tests/notifications.test.ts` proves Slack incoming webhooks are encrypted, never returned,
tenant-scoped, unpaid saves return 402, Solo paid returns 403, a delivery test never inserts
an alert, real alerts POST after insert, and `notification_deliveries` are append-only.
The same file proves SIEM HTTPS webhooks follow those rules, reject private/local/Slack
hosts, skip fetch when DNS resolves private, never return the URL or query token, and
POST JSON with `inventedIncident: false`.
The same file proves Jira Cloud destinations encrypt email+token, never return them, reject
non-`*.atlassian.net` hosts, skip fetch when DNS resolves private, test with GET myself+project
(never POST `/issue`, never insert an alert), and real alerts POST `/rest/api/3/issue`.
The same file proves PagerDuty destinations encrypt the routing key, never return it, lock
the host to `events.pagerduty.com`, skip fetch when DNS resolves private, test with POST
`/v2/change/enqueue` (never POST `/v2/enqueue`, never insert an alert), and real alerts POST
`/v2/enqueue` with `event_action: trigger`.
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
members can watch and test but cannot save email/Slack/SIEM/Jira/PagerDuty, map custody, routes, registries, scan tokens, allowlists,
or open setup/remediation PRs, role changes are trial/Team only (Solo 403, unpaid 402),
GitHub suspend does not block role changes, and the last admin cannot be demoted or removed.
`tests/github-response.test.ts` proves make-private, delete-pack-assets, and disable-workflow
are install-admin only, require typed confirmation, 409 until Administration without audit,
refuse `.github/workflows/nospoilers.yml`, hide other tenants, unpaid GET is allowed, unpaid
POST is 402, GitHub suspend is 409, and a mocked Administration write records audit plus a
Watch alert that is a confirmed response, not a discovered incident.
`tests/web-origin.test.ts` proves website watches are tenant-scoped, unpaid POST returns 402,
SSRF skips fetch, unwatch audit stores the host only, exposed `.env` and `.git` files alert
without storing secret values, SPA catch-all HTML is not treated as a secret file,
off-origin credential hrefs are not fetched, website crawl jobs are light, an
unchanged poll does not take a daily unpack slot or block a Release scan, and a
crawl that scans consumes one slot.
`tests/map-custody.test.ts` proves Sentry/Bugsnag tokens are encrypted, never returned, never
written onto jobs, tenant-scoped, unpaid saves return 402, members cannot save, Solo paid may
save, private DNS skips fetch, missing private artifacts flag MAP-011, public maps flag MAP-012,
and Bugsnag without a release is inconclusive (debug ID lookup is not available).
`tests/secrets.test.ts` proves hosted `/api/scan`, GitHub OAuth start, and owner discovery
return 429 after the configured cap, that anonymous 401s do not consume the discovery budget,
and that GitHub webhooks are not rate-limited. `tests/docs.test.ts` proves `/docs` states we
never execute packages or retain source, email delivery is not live yet without Resend keys, and Electron stays later.
`tests/stripe.test.ts` proves Checkout and the portal stay 503 without keys, only an install
admin can start them, members and other tenants are 403, unpaid installs can subscribe,
already-subscribed Checkout returns the portal, signed lifecycle events set and clear plan
idempotently, a failed payment stops hosted work, a stolen customer cannot move to another
install, and API bodies never include Stripe object IDs or secrets.
`tests/production-runtime.test.ts` proves the built SPA is served from the API process,
path traversal cannot leave the UI root, `/api` stays JSON, enqueue NOTIFY does not throw
on PGlite, and `NOSPOILERS_ROLE=web` does not claim jobs.
Keep those tests green when adding internal routes.
