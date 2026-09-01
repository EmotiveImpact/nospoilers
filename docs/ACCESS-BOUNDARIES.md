# Access boundaries

This file is the authorization source of truth for NoSpoilers. Product PRDs describe
what exists; this file describes **who may see or change it**.

Employee Public Footprint is a separate future application. It is not built in this
repository and has no role here.

## Roles

### Public Visitor

Unauthenticated browser traffic.

**May**

- View Product, Pricing, documentation, Privacy, Terms, Retention, Disclosure, Support, Refunds, and the public Status page (`/status`).
- Open Watch and Scan marketing/preview layouts (`?as=trial`, `?as=ended`).
- Use the local pack drop zone (`POST /api/scan`) within hard size limits.
- Verify a signed receipt JSON they already have (`POST /api/receipts/verify`) against this instance’s HMAC key.
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
- Protect a watched npm package’s identity after the npm scope or GitHub repository field
  matches this GitHub install. Naming an arbitrary pack is not ownership. Maintainer,
  repository, homepage, and artifact-shape changes append snapshots and explainable alerts.
- Watch packs from private HTTPS registries already saved on those installations. Token
  values are never returned.
- Trigger a latest-release scan on those repositories while coverage is active.
- Read the packed-artifact setup workflow YAML and the remediation file bundle on those
  repositories. Opening the reviewable PRs is an install admin action.
- Read signed scan receipts for those installations and diff against an approved baseline
  (or the last two receipts if none is approved).
- View their own coverage status.
- See GitHub App suspend, unsuspend, permission-change, and repository add/remove
  alerts on installations they belong to. Uninstall drops the tenant; there is no
  Watch surface left for an uninstall notice.
- List recent jobs for those installations (kind, status, attempts, error, timestamps).
  Payloads, prospect scans, and other tenants are not included. Jobs cannot be patched
  or deleted by customers.
- Run a live GitHub permission test on installations they belong to. The test never
  inserts an alert and never claims a security incident. It reports the last customer
  job (kind, status, time) for that install, or that none exist. It stays available
  when coverage has ended or GitHub has suspended the App.
- Acknowledge, assign (to a GitHub login on that install), resolve with a note, and
  reopen alerts on installations they belong to. Incident state stays available when
  coverage has ended or GitHub has suspended the App. Alert events are append-only.
  They may export that same activity as JSON for their installs.
- Use a scan API token an install admin already minted. `POST /api/v1/scan` with that
  Bearer token unpacks a packed artifact, applies the installation allowlist, mints a
  receipt, and deletes the bytes.
- List append-only release revisions for those installations (channel, digests, source
  revision, stored CI run URL). Historical rows cannot be edited or deleted.
- List Slack and SIEM destination hosts on a trial or Team install (URLs are never
  returned). A delivery test talks to the destination and never inserts an alert.
- Read this install’s 90-day timeline (alerts, acknowledgement activity, and notification
  deliveries) on a trial or Team install. Solo paid returns 403. Unpaid returns 402.
  Another tenant’s installation is empty. Titles only; webhook URLs and secret values
  are not included.
- List people on this install (GitHub login and admin/member role). Other tenants are empty.

**Must not**

- Link an arbitrary GitHub installation ID they do not own. Setup verifies the signed-in
  user owns that install on this App.
- Change roles, remove members, save or delete Slack/SIEM webhooks, save or delete private
  registry tokens, mint or revoke scan API tokens, manage allowlists or baselines, or open
  setup or remediation PRs. Those writes need an install admin.
- See other tenants’ registry tokens, Slack or SIEM webhooks, scan API tokens, ciphertext, alerts, repos, jobs, artifacts, scan receipts, or release revisions.
- Edit or delete scan receipts, release revisions, jobs, or alert events. Receipts, revisions, and alert events are append-only; the customer job list is read-only.
- Patch alert titles or bodies. Resolve with a note instead.
- Assign an alert to a GitHub login that is not a member of that installation.
- Access `/internal/*` or `/api/internal/*`.
- Read prospect companies, disclosure records, campaigns, global jobs, or infrastructure costs.

### Customer Administrator

A member who can manage the customer’s GitHub installation membership and product settings
on a trial or Team install. The first GitHub user to connect an install is admin; later
users become members. Solo paid returns 403 for role changes. Unpaid returns 402. GitHub
suspend does not block role changes. Email invite is not built.

**May**

- Promote, demote, and remove people on that install. The last admin cannot be demoted
  or removed (409).
- Save and delete encrypted Slack incoming webhooks and SIEM HTTPS webhooks on a trial
  or Team install. URLs are never returned after save. Private, local, metadata, and Slack
  hosts are rejected for SIEM, and DNS must resolve to a public address before POST.
- Save encrypted private npm registry tokens (never returned after save).
- Mint and revoke hashed scan API tokens. The secret is shown once and never stored.
- Manage expiring allowlist exceptions and approve scan baselines.
- Open a reviewable setup PR or remediation PR while coverage is active. The App never
  merges those PRs. Required Contents write and Pull requests write are shown before the
  button. Existing customer ignore/policy/workflow files are not overwritten. This is not
  make-private, asset deletion, or workflow disable.

**Must not**

- Anything on the internal operator list below.
- Demote or remove the last admin.

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
- See global queue depth, failed jobs, and cost controls when those exist.
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
| Global job/queue operations | worker internals, not a customer page |
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

## How access is checked today

1. **Public / customer APIs** — signed session cookie `ns_session` where required.
2. **Internal APIs** — `Authorization: Bearer $ADMIN_TOKEN`, `x-admin-token`, **or** a
   session whose GitHub login matches `ADMIN_GITHUB_LOGIN` (default `EmotiveImpact`).
3. Health reports `database.mode` as `neon`, `postgres`, or `pglite` and never the URL.
   `/status` renders that same public liveness payload.

## Tests

`tests/prospects.test.ts` proves anonymous and ordinary customer sessions cannot list or
mutate Artifact Leads. `tests/receipts.test.ts` proves customers cannot read another
tenant’s receipts and that receipts cannot be patched. `tests/policy.test.ts` proves
allowlist entries are tenant-scoped, unpaid writes return 402, revoke does not DELETE
the row, unrelated rules stay unsuppressed, and Release Diff uses the approved baseline.
`tests/setup-pr.test.ts` proves setup-PR YAML is tenant-scoped, unpaid POST returns 402,
permission skips return copy-paste YAML instead of failing the worker, and the merge API
is never called. `tests/remediation.test.ts` proves remediation files are tenant-scoped,
unpaid POST returns 402, GitHub-suspended POST returns 409, permission skips return
copy-paste files, required permissions are listed before write, customer ignore/policy
files are not overwritten, empty `.nospoilers.yml` has no allowlist, and the merge API
is never called. `tests/npm-watch.test.ts` proves private registry tokens are encrypted,
never returned, blocked off-tenant, and never written onto jobs. `tests/scan-api.test.ts`
proves scan API tokens are hashed, shown once, tenant-scoped, unpaid mint/scan return 402,
and revoked tokens cannot unpack. `tests/release-ledger.test.ts` proves release revisions
are append-only, tenant-scoped, flag digest mismatch without a compromise claim, reject
SSRF CI URLs, and keep older HMAC receipts verifiable. `tests/package-identity.test.ts`
proves arbitrary npm names cannot be protected, identity snapshots are append-only, and
maintainer/repository/shape alerts never store emails or issue a malware verdict.
`tests/install-health.test.ts` proves GitHub suspend/unsuspend/permission/repo-change
alerts are tenant-scoped and coverage-gated, uninstall drops the tenant, `/api/jobs`
never returns payloads or prospect scans, and other tenants cannot read those jobs.
`tests/incident-response.test.ts` proves live permission tests never insert an alert,
alert acknowledgement/assignment/resolution is tenant-scoped, off-install assignees
are rejected, unpaid and GitHub-suspended installs can still acknowledge and test,
`alert_events` cannot be updated or deleted, and activity export is tenant-scoped.
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
`tests/timeline.test.ts` proves the 90-day timeline is tenant-scoped, drops rows older than
90 days, returns 403 for Solo and 402 when unpaid, and does not invent incidents.
`tests/roles.test.ts` proves the first linked user is admin and later users are members,
members can watch and test but cannot save Slack/SIEM, registries, scan tokens, allowlists,
or open setup/remediation PRs, role changes are trial/Team only (Solo 403, unpaid 402),
GitHub suspend does not block role changes, and the last admin cannot be demoted or removed.
Keep those
tests green when adding internal routes.
