# Next-agent handoff

Read in this order:

1. `docs/PRODUCT.md` — product source of truth
2. `docs/expansion/NO-SPOILERS-ULTIMATE-PRD.md` — complete product and phased plan
3. `docs/expansion/FEATURE-INVENTORY.md` — exhaustive feature accounting
4. `docs/ROADMAP.md` — immediate milestones and exit criteria
5. `docs/ACCESS-BOUNDARIES.md` — who may see customer vs owner-only surfaces
6. `CHANGELOG.md` — completed work
7. `README.md` — operation and GitHub App checklist
8. `docs/ELECTRON.md` — installer work intentionally on ice
9. `docs/MONTH1.md` — evidence-led acquisition
10. `docs/products/README.md` — final platform/module boundary and PRDs

## Repository

- Private GitHub repository: `EmotiveImpact/nospoilers`
- Branch: `main`
- Server: `http://127.0.0.1:4347`
- Do not create a PR unless asked. Commit and push each logical change.

## Database

- Neon project: `NoSpoilers`
- Default branch: `production`
- Database: `neondb`
- Neon Auth: disabled; NoSpoilers uses GitHub OAuth.
- Twenty-seven product tables plus `schema_migrations`. Migrations `001_init`, `002_coverage`,
  `003_prospects`, `004_billing_accounts`, `005_watched_packages`, `006_scan_receipts`,
  `007_policy_exceptions`, `008_npm_registries`, `009_scan_api_tokens`,
  `010_release_revisions`, `011_package_identities`, `012_install_health`,
  `013_incident_response`, `014_notification_destinations`, `015_siem_destinations`,
  `016_installation_roles`, `017_jira_destinations`, `018_notification_routes`,
  `019_audit_events`, `020_identity_signals`, `021_retention_policies`,
  `022_watched_origins`, `023_map_destinations`, `024_fair_use_concurrency`,
  `025_hosted_usage`, `026_github_response`,   `027_team_invites`,
  `028_identity_dependencies`, `029_identity_unpacked_bytes`,
  `030_identity_provenance`, `031_identity_publisher`, `032_prospect_workspaces`, and
  `033_prospect_npm_feed` are applied. `026_github_response` only
  extends `audit_events.action` for Watch GitHub responses. `027_team_invites` adds
  `installation_invites`. `028_identity_dependencies` adds
  `package_identity_snapshots.dependency_names`. `029_identity_unpacked_bytes` adds
  `package_identity_snapshots.unpacked_bytes`. `030_identity_provenance` adds
  `has_attestations`, `attestation_predicate`, and `signature_keyids` on identity snapshots.
  `031_identity_publisher` adds `publisher_name` and `trusted_publisher`.
  `032_prospect_workspaces` adds `prospects.workspace_members`.
  `033_prospect_npm_feed` adds `prospects.feed_checked_at`.
  `034_delivery_verify` adds `release_delivery_locations` and append-only
  `release_delivery_verifications`, and extends `audit_events.action` with
  `delivery_location.save`. The 027 audit-action check is applied only on first
  migrate so later `delivery_location.save` rows are not rejected.
  `hosted_usage_days` counts heavy hosted unpacks per
  installation per UTC day (fair use, not a credit meter). Hosted
  coverage belongs to the GitHub installation billing account, not the user row. Scan receipts are
  append-only HMAC JSON; they store manifests and hashes, never source. Release revisions are
  append-only (`stable` / `beta` / `canary`, SHA-256/SHA-512, source revision, stored CI URL).
  UPDATE/DELETE on `release_revisions` is rejected. Install admins can attach HTTPS delivery
  URLs to a sealed revision and verify them now (`delivery_verify` light job, enqueue wakes
  the worker). A public GitHub Release download URL and a public npm tarball URL are
  attached when that revision is sealed (no verify job). Private repos and private
  registries are not. The worker stream-hashes and deletes the download. A GitHub Release
  download URL may hop once to GitHub’s asset CDN after a second public-DNS check;
  other cross-host redirects are not fetched. This is not added to the
  hourly poller. Query strings are redacted on Watch, alerts, and audit. Private registry tokens are
  AES-GCM ciphertext (`ns1.` prefix) and are never returned after save. Slack incoming webhooks,
  SIEM HTTPS webhooks, and Jira Cloud email+token are the same ciphertext and are never returned
  after save. Jira stores a plaintext project key for the list UI. Notification deliveries are
  append-only. Scan API tokens are SHA-256
  hashes (`nsp_` secrets shown once). `installation_users.role` is `admin` or `member`
  (first linked user is admin). Alert acknowledgement, assignment, resolution notes, and
  reopen append `alert_events` (append-only). Admin writes append `audit_events` (append-only).
  `billing_accounts.retention_days` is 90, 180, 365, or 0 (keep while this install exists).
  Lists use `row_within_retention`; append-only evidence is never deleted by that window.
  Live permission tests store JSON on the installation,
  including the last customer job kind/status/time, and never insert an alert. `/status` is public
  liveness from `/api/health`. Watched production websites are HTTPS origins; the crawler fetches
  HTML plus same-origin JS/CSS/maps and a bounded probe of exposed files, credentials, and
  linked internal paths, never executes JavaScript, and deletes bytes after the scan.
  Map custody stores encrypted Sentry/Bugsnag tokens (never returned) and looks up debug IDs or
  release names after a website or npm scan. The worker does not download map source. Bugsnag
  matches a release version; it cannot look up a debug ID.
  Development receipts use `RECEIPT_SECRET`
  (falls back to `SESSION_SECRET`) behind the `dev-hmac` signer adapter. Production signing should
  move to KMS. Policy exceptions are
  revoked in place (no silent DELETE). Scan baselines supersede the previous active row for a
  package.
- The application boots with `DATABASE_URL` from `.env` (gitignored). Keep that same URL as a
  Cloud Agent Runtime Secret so new runs do not fall back to PGlite.
- Do not import local PGlite data; Neon starts clean.
- `/api/health` reports `{ database: { mode: "neon" | "postgres" | "pglite" } }` and never the URL.

## Runtime facts

- Without `DATABASE_URL`, development uses PGlite under `data/nospoilers`.
- API routes wake the worker immediately after enqueue. The 15-minute timer is recovery only.
  Failed jobs retry with backoff; stale running locks are requeued. GitHub OAuth tokens are
  encrypted at rest. `github_app_authorization` revoked drops that user’s sessions and discards
  the stored token. Sign-out deletes only the current session. The GitHub installation stays
  until `installation.deleted`. HMAC is still required. Coverage does not gate revoke.
  `installation_target` renamed updates the stored account login in place (no job, unpaid still
  updates). Hosted `/api/scan` is rate-limited per address. GitHub OAuth start/callback and owner discovery
  are rate-limited per address. Receipt verify uses a separate per-address budget. GitHub webhooks are not. HTTPS origins set Secure cookies.
  Neon and https origins refuse to boot with short or default `SESSION_SECRET` / webhook secrets.
  `/api/ready` pings the database. Logs are JSON lines (`event`, `level`, `ts`) with secrets redacted.
- Public Privacy, Terms, Retention, Disclosure, Support, and Refunds pages are live.
- Public `/docs` covers Watch, packed scans, coverage, and what we never do. It does not claim
  Stripe or Electron are live.
- Customers can watch public npm packages on a covered install. Connecting a name scans `latest`
  plus `next`/`beta`/`canary`/`rc`/`alpha`/`preview` tarballs when those tags point at another
  version (cap three extras). The hourly poller and Watch “Check now” enqueue new versions,
  mutated tarballs, channel-tag tarballs, and tag-only alerts for other dist-tag moves.
  A later registry 404 after a recorded version is a Watch `package_unpublished` alert
  without downloading. A 5xx or network error is not treated as unpublish.
  Private HTTPS registries (GitHub Packages, GitLab, Verdaccio, …) take an encrypted read token;
  tarball hosts must match the saved origin. Tokens are never returned and never written onto jobs.
  Covered npm and GitHub release scans persist a signed receipt and can diff the last two. A later
  pack that is twice as large, or at least 5 MiB larger unpacked, mints SIZE-003 against the
  approved baseline or the previous receipt. First scans do not. The finding is a warning,
  allowlistable, and appears on Watch alerts and GitHub Checks. Source is not stored. The
  15-minute worker timer is still recovery only — enqueue wakes the worker. GitHub Release
  `edited` (and prereleased/released) enqueue another heavy scan only when pack assets change.
  `unpublished` and `deleted` are light alerts and never download.
- Customers can add expiring, attributable allowlist exceptions (exact rule + optional path glob)
  and approve a packed receipt as the shipping baseline. Hosted scans apply those exceptions
  before minting a receipt. CLI and the GitHub Action load `.nospoilers.yml` when present.
- Watch **Setup PR** opens a reviewable PR that adds `.github/workflows/nospoilers.yml` and a
  vendored `.github/actions/nospoilers` composite Action. That workflow lists existing
  `package.tgz` and `dist/` packs (cap 8), POSTs each to hosted `/api/v1/scan`, and fails closed
  if none exist. Source pushes are not unpacked. Customer CI cannot `uses:` this private product
  repo. After merge, set repository variable `NOSPOILERS_API_URL` and secret `NOSPOILERS_API_TOKEN`
  from a Watch-minted token. Watch Scan API shows the current `APP_BASE_URL` as
  `NOSPOILERS_API_URL` and whether GitHub-hosted runners can reach it (HTTPS, not loopback).
  Anonymous `/api/me` omits that origin. The App never merges the PR. Watch and the PR body tell maintainers
  to mark the NoSpoilers check required; the App does not set branch protection. If GitHub
  returns 403/404, the API returns 409 plus copy-paste files. Hosted `release_scan` jobs post a
  **NoSpoilers** Check with rule/path annotations when Checks write is granted; otherwise the job
  still completes.
- This repository’s GitHub Actions rebuilds fixtures then `npm run ci:fixtures`. Every
  `sourcemap.*` pack and `dotenv.tgz` must fail closed; every `clean.*` pack and
  `workspace.tgz` must pass; every `inconclusive.*` pack must exit 2 (not a passing
  receipt). An unclassified fixture fails the gate. The same job then runs the GitHub
  Action (`uses: ./`) on `fixtures/clean.tgz` (must pass) and `fixtures/sourcemap.tgz`
  (must fail closed). Generated customer CI vendors a hosted-scan Action instead of `uses:` on
  this private repository.
- Watch **Remediation PR** opens a reviewable PR on `nospoilers/remediate` with ignore rules,
  an empty `.nospoilers.yml` (no silent allowlist), bundler hints, a `package.json` `files`
  snippet, and the packed-artifact workflow plus vendored hosted-scan Action if missing. Existing
  customer ignore/policy/workflow/Action files are not overwritten. Contents write commits
  non-workflow files. GitHub Actions YAML stays copy-paste; Workflows write is not requested.
  Pull requests write is shown before
  the button. 409 returns the file bundle for copy-paste and names any committed branch/paths.
  The App never merges it. This is not
  make-private or asset deletion.
- Packed scans discover npm/pnpm/Yarn/Bun workspaces (package.json `workspaces`,
  `pnpm-workspace.yaml`, yarn/bun lockfile presence). Members are listed on the report, receipt,
  SARIF properties, alerts, and Checks. They are never executed and never auto-connected as
  watched packages.
- Crash dumps, Windows minidumps, and ELF `ET_CORE` files fail as CRASH-001 (never executed).
  Extra DWARF/gcov/breakpad symbols stay DBG-001 warnings.
- Covered installs can mint hashed scan API tokens (shown once). `POST /api/v1/scan` unpacks a
  packed artifact, applies the allowlist, mints a receipt, appends a release revision, and
  deletes the bytes. Optional headers: `X-NoSpoilers-Channel`, `X-NoSpoilers-Source-Revision`,
  `X-NoSpoilers-CI-Run` (HTTPS, stored, never fetched). Unpaid mint/scan
  return 402. Exhausted daily fair use returns 429 with Retry-After until 00:00 UTC, not a
  remaining-credit balance. This repository’s GitHub Action stays `uses: ./`. Customer Setup CI
  vendors a hosted-scan Action and needs a Watch token. Watch **Releases** lists sealed
  revisions with the linked receipt status; preview invents none. Unpaid still allows the list
  and receipt download. Failed-policy and inconclusive are not clean. Watch **Protect identity** verifies npm scope or GitHub
  repository ownership before snapshotting maintainers and metadata. Trial and Team installs
  generate bounded lookalike names (metadata only, never download lookalike tarballs), dormant
  resurrection, release-burst/version-jump alerts, new-dependency alerts when a protected
  pack starts depending on a package first published within 14 days, packument unpacked-size
  jumps (2× or ≥5 MiB versus the last snapshot’s `dist.unpackedSize`, no download), and npm
  attestation presence / registry signature keyid changes (packument fields only; the
  attestation URL is not fetched and signatures are not verified). Admins allowlist with a reason and typed
  candidate name. This is not a malware verdict and not auto advisory/takedown.
- Covered installs get Watch alerts when GitHub suspends/unsuspends the App, accepts new
  permissions, or adds/removes repositories. Uninstall still deletes the tenant. Watch
  **Install health** lists this install's jobs (no payloads, no prospect scans) and fair-use
  warning or pause copy when the daily hosted unpack cap is near or exhausted. GitHub
  suspend is not treated as unpaid coverage; GitHub-backed writes return 409.
- Packed scans flag Azure/GCP service-account documents, PKCS12, terraform state, build
  caches (CACHE-001), and additional AI/MCP agent files. Credential values are not copied
  into reports. DOC-001 also flags architecture/design/rfc/spec/product/month1/
  feature-inventory/electron, `*.prd.md`, `docs/internal/`, and numbered ADRs.
- Packed scans also cover VSIX, CRX, XPI, Chrome extension ZIPs, Python wheels and sdists, JAR/WAR, NuGet nupkg/snupkg, and
  Ruby gems. Classification uses ZIP/tar/CRX magic, not the extension alone. Encrypted zip
  and CRX wrappers without a ZIP payload are inconclusive, never a passing receipt. Zip-slip
  entry names flag ARC-002 and are not unpacked for content. GitHub Release asset matching
  includes those extensions. Scan lists VSIX, CRX, XPI, Chrome ZIP, wheel, sdist, JAR, nupkg, and gem fixture
  examples. Python and extension workers are never executed. These formats are not a Pricing extras change.
- Packed scans also cover Docker save and OCI image archives. Layout sniff uses `manifest.json`
  plus `layer.tar`, or `oci-layout` / `blobs/sha256`. Gzip layer blobs without a `.tar` name are
  unpacked. Overlay whiteouts are not applied, so lower-layer spoilers remain visible. Encrypted
  layers are inconclusive. Image signatures are not verified or executed. Scan lists docker-save
  and OCI fixture examples. Not a Pricing extras change.
- Packed scans also cover Android APK/AAB and iOS IPA. Layout sniff uses `AndroidManifest.xml` /
  `classes.dex`, `BundleConfig.pb`, or `Payload/*.app`. ZIP magic, not the extension. Encrypted zip
  is inconclusive. APK Signature Scheme v1–v4, Play App Signing, and Apple code signatures are not
  verified. FairPlay-encrypted Mach-O is not decrypted. DEX, native libraries, and Mach-O are never
  executed. Scan lists APK, AAB, and IPA fixture examples. Not a Pricing extras change.
- Packed scans also cover serverless deployment zips (AWS Lambda, Azure Functions, Netlify
  Functions, Vercel output). Layout sniff uses `host.json`, `serverless.yml`, `.aws-sam`,
  `netlify/functions`, or `.vercel/output`, or a `.lambda.zip` name. ZIP magic, not the extension
  alone. Encrypted zip is inconclusive. Handlers, bootstraps, and native binaries are never
  executed. Scan lists a Lambda zip fixture example. Not a Pricing extras change.
- Covered installs can watch HTTPS production websites (same-origin JS/CSS/maps plus bounded
  probes for exposed files, credentials, and linked internal paths, SSRF-blocked, never
  executed). Admins can connect Sentry or Bugsnag map custody. Tokens are encrypted and
  never returned. After a website or npm scan the worker looks up debug IDs (Sentry) or release
  versions (Bugsnag) and alerts if the private upload is missing or a public map is still
  served. Bugsnag cannot look up a debug ID. Not a Pricing extras change.
- Watch **Test install** runs a live GitHub permission/read probe. It never creates an
  alert. It reports Members read and optional Contents/Pull requests/Checks write, and
  warns if Administration was granted. If the App requested a permission the install has
  not accepted (live: Members read), Test install names it and links to GitHub’s Accept
  page. It never asks the customer to grant Administration. Missing optional grants do
  not fail the test. Watch alerts can be acknowledged, assigned to an install member,
  resolved with a note, and reopened. Exposure duration and a SEC/MAP rotation checklist
  are shown. Watch can export that activity as JSON. Incident actions stay available when
  unpaid or GitHub-suspended.
- Trial and Team installs can save a Slack incoming webhook, a SIEM HTTPS webhook, and a Jira
  Cloud destination (encrypted, never returned). New Watch alerts POST to those destinations
  after they are stored. Watch **Test delivery** talks to Slack, SIEM, or Jira and never
  inserts an alert. A Jira test GETs myself+project and never creates a ticket. Solo paid does
  not get Slack, SIEM, or Jira. Email still needs Resend. SIEM hosts cannot be private, local,
  metadata, or hooks.slack.com. Jira is `*.atlassian.net` only. Trial and Team installs can
  save routing rules (min severity, repository, package, teammate assign) per destination.
  Destinations without a route still receive every Watch alert. A routed test talks to matching
  destinations and never inserts an alert.
- Trial and Team installs get a Watch **audit log** of admin writes plus a titles-only export of
  alerts and notification deliveries. Destructive deletes require typing the public identifier.
  Solo 403. Unpaid 402. Members may read/export. Append-only. Never stores URLs, emails, tokens,
  or secret values.
- Trial and Team installs get a Watch **90-day timeline** of this install’s alerts,
  acknowledgement activity, and notification deliveries. Solo 403. Unpaid 402. No invented
  rows.
- Trial and Team installs get Watch **Team** roles. The first GitHub user to connect is
  admin; later users are members. Admins can promote, demote, and remove. The last admin
  stays. Solo 403. Unpaid 402. GitHub suspend does not block. Members keep Watch, ack, and
  delivery tests. Admins save Slack/SIEM/Jira, map custody, routes, registries, scan tokens, allowlists, baselines,
  and open setup/remediation PRs. Trial/Team can invite by GitHub login. No email (Resend is
  benched). They become that role when they sign in after GitHub lists them on this App.
  First-user-admin still wins if a member invite would leave zero admins.
- Watch one-click GitHub responses are in (make-private, delete latest Release pack assets,
  disable a workflow that is not `.github/workflows/nospoilers.yml`). Install admin, typed
  confirm, unpaid 402, GitHub suspend 409, members 403. 409 until Administration (not
  granted). Contents write is not enough. Success writes audit plus a Watch alert that is a
  confirmed response, not a discovered incident. Do **not** grant Administration.
- The GitHub App (`nospoilers-dev`) requests Contents write, Members read, and Metadata
  read. Live install `158159401` on `EmotiveImpact` (`repository_selection: all`) has
  Contents write and Metadata read. Members read is still requested on the App and not
  accepted on the install. Pull requests write and Checks write are not requested.
  Administration is not granted. Do **not** grant Administration. Do **not** request
  Workflows write (Actions YAML). Watch one-click responses stay 409 until Administration,
  which we will not take. Setup/remediation PRs stay copy-paste until Pull requests write.
- The hourly GitHub visibility poller is separate and remains enabled.
- Artifact Leads is `/internal/prospects`. Create a new long random `ADMIN_TOKEN`; do not reuse the
  prior temporary local token. `GITHUB_DISCOVERY_TOKEN` is optional.
- Prospecting scans public GitHub Release assets, the root npm package, and up to eight
  public workspace member packs named from the repo workspace config. Scanned packs store
  member names (not source). Members are not auto-watched. The hourly poller, after
  customer work, checks known npm leads for a new latest and can run a three-repo
  discover when `GITHUB_DISCOVERY_TOKEN` is set. It does not clone source,
  retain bytes, auto-contact maintainers, or scan Electron installers over the limit.

## Critical truth

The scanner, UI, and Neon runtime work. The commercial hosted product is not launch-ready:

- `EmotiveImpact/nospoilers-throwaway` produced real Watch alerts: `repository.created` →
  `repo_created_public`, cheap `.env`/`.map` push, and `release.published` → `release_scan`
  done → “Spoilers in EmotiveImpact/nospoilers-throwaway phase1-fixture” plus receipt
  `github:EmotiveImpact/nospoilers-throwaway@phase1-fixture#sourcemap.tgz` (`failed-policy`,
  MAP-001/002/003). `npm run phase1:throwaway` is idempotent and skips Actions YAML.
  Stripe and Resend are benched.
- Production deployment does not exist. Slack, SIEM, and Jira destinations are live on trial/Team.

Do not describe these as complete because the UI exists.

## Exact next prompt

```text
Continue NoSpoilers from the repository handoff. Read docs/PRODUCT.md,
docs/expansion/NO-SPOILERS-ULTIMATE-PRD.md, docs/expansion/FEATURE-INVENTORY.md,
docs/ROADMAP.md, docs/HANDOFF.md, docs/ACCESS-BOUNDARIES.md, and CHANGELOG.md first.
Phase 0 is done. Milestone 2 (installation billing + unpaid enforcement) is done.
Legal/support pages and strong secret checks are done.
Public npm package watching (latest plus next/beta/canary channel tarballs) is in.
Private npm registries (encrypted tokens, same-host tarballs) are in.
Release manifests, signed receipts, inconclusive status, and Release Diff are in.
Nested packs, backups, dumps, internal docs, and escaping symlinks are flagged.
Nested tgz/zip/asar/docker/oci/apk/ipa/serverless layers are unpacked for inspection (never executed).
`.nospoilers.yml`, expiring allowlists, and baseline approval are in.
Setup PR + GitHub Checks are in code (reviewable, never merged; Checks skipped on 403).
Watch Setup status probes Action/workflow presence and a NoSpoilers check (never invents
an alert; cannot see or set branch protection).
Generated setup CI vendors `.github/actions/nospoilers` and POSTs existing package.tgz and dist/ packs to hosted `/api/v1/scan`; fails closed if none. Watch shows the current hosted origin for `NOSPOILERS_API_URL` when signed in.
Packed npm/pnpm/Yarn/Bun workspace discovery is in (list only; never execute; never auto-watch).
Hosted scan API tokens + POST /api/v1/scan are in (hashed, shown once, 402 when unpaid).
Release Ledger foundations are in (append-only revisions, channels, source revision, stored CI URL,
on-demand delivery URL verify against the sealed digest; public GitHub
Release and public npm tarball URLs attach on seal; GitHub Release
download hops to the asset CDN; live-matched throwaway phase1-fixture
sourcemap.tgz; not scheduled CDN).
Package Identity foundations are in (verified protect, maintainer snapshots, repo/homepage/shape,
publishing identity / trusted publisher).
Install health is in (suspend/unsuspend/permissions/repo-change alerts; tenant job list).
Incident response is in (live permission test with no invented incident; last customer job on
that test; alert ack/assign/resolve; exposure duration; rotation checklist; append-only alert_events).
Multiple GitHub organizations are in (Watch install switcher; `installationId` list filter;
writes require an id when two+ installs exist; coverage/suspend per install).
Public `/status` is in (health liveness only).
Slack incoming webhooks are in (trial/Team, encrypted, event-driven, test never invents an incident).
SIEM HTTPS webhooks are in (trial/Team, encrypted, SSRF-blocked, event-driven, test never invents an incident).
Jira Cloud tickets are in (trial/Team, `*.atlassian.net` only, encrypted email+token, test never
creates an issue or Watch alert).
Team alert routing is in (trial/Team, severity/repo/package/teammate/destination, routed test never
invents an incident, destinations without a route still receive every alert).
Team audit log is in (trial/Team, append-only, typed confirm on destructive writes, export never
includes secrets; Solo 403; unpaid 402; members may read/export).
90-day Team timeline is in (tenant-scoped, Solo 403, unpaid 402, no invented rows).
Team members and roles are in (first user admin; later members; trial/Team; last admin stays;
GitHub suspend does not block; GitHub-login invite with no email; members cannot save Slack/SIEM/Jira/routes/registries/tokens/allowlists/PRs).
Package Identity Team signals are in (bounded lookalikes, dormant resurrection, burst/jump,
new dependency toward a package first published within 14 days, packument unpacked-size
jumps (2× or ≥5 MiB versus the last snapshot, metadata only), and npm attestation
presence / signature keyid changes (packument only; no fetch, no verify); trial/Team; metadata-only
candidate and dependency-name checks; typed allowlist; no malware verdict; no tarball
download of the added dependency).
Configurable data retention is in (90/180/365/keep; query-time lists; typed confirm; Solo
allowed; unpaid 402; append-only evidence never deleted).
Extra packed formats are in (VSIX/CRX/XPI/Chrome ZIP/wheel/sdist/JAR/nupkg/gem; ZIP/tar magic; CRX header
stripped; encrypted zip and CRX-without-ZIP inconclusive; zip-slip ARC-002 not unpacked for
content; GitHub Release `isPackAssetName` extended; Scan VSIX/CRX/XPI/wheel/JAR/nupkg/gem
examples). Not advertised as a Pricing change.
Docker/OCI image layers are in (docker save + OCI layout sniff; layer tars and gzip blobs;
overlay whiteouts not applied; encrypted layers inconclusive; signatures not verified; Scan
docker-save and OCI examples). Not advertised as a Pricing change.
APK/AAB/IPA are in (ZIP magic; AndroidManifest/BundleConfig/Payload layout; DEX/Mach-O never
executed; signatures not verified; FairPlay not decrypted; encrypted zip inconclusive; Scan APK,
AAB, and IPA examples). Not advertised as a Pricing change.
Serverless deployment bundles are in (ZIP magic; host.json / serverless.yml / .aws-sam /
netlify/functions / .vercel/output layout or `.lambda.zip` name; handlers never executed;
encrypted zip inconclusive; Scan Lambda zip example). Not advertised as a Pricing change.
Production website crawls are in (HTTPS origin, same-origin JS/CSS/maps plus bounded probes for
exposed files, credentials, and linked internal paths, SSRF-blocked, never executed, event-driven
enqueue, hourly poller enqueues only). Not advertised as a Pricing change.
Sentry/Bugsnag map custody is in (matching debug ID or release, private lookup, public map absent,
encrypted tokens never returned or written onto jobs, event-driven). Not advertised as a Pricing
change. Bugsnag matches a release version; it cannot look up a debug ID.
Automatic remediation PRs are in (reviewable, never merged; empty policy; no overwrite of customer
ignore/policy/workflow/Action files; workflow YAML stays copy-paste; 409 until Pull requests write).
DOC-001 expansion is in (architecture/PRD/internal docs/ADRs).
Extra inspect is in (cloud/service-account, PKCS12, CACHE-001, broader AI/MCP pack).
Fair-use hosted unpacks are in (Solo 1 concurrent heavy job and 8 per UTC day per install;
Team/trial 3 concurrent and 24/day; global heavy cap still applies; Watch warning/pause copy;
owner queue usage aggregates; no scan-credit meter). Not advertised as a Pricing change.
Owner queue health is in (`GET /api/internal/queue` counts on Artifact Leads; customer vs prospect;
stale locks; daily unpack aggregates; no payloads). Not a customer page.
SIZE-003 unexpected unpacked growth is in (2× or ≥5 MiB versus previous receipt or approved
baseline; first scans do not; warn; allowlistable; Watch Diff and Checks). Not a Pricing change.
Prerelease npm channel tarballs are in (`next`/`beta`/`canary`/`rc`/`alpha`/`preview` when those
tags point at another version, cap three extras; other dist-tags stay tag-only). Event-driven.
Not a Pricing change.
  A watched npm name that 404s after a recorded version writes `package_unpublished` (no
download; 5xx is not unpublish; unpaid skips). Event-driven. Not a Pricing change.
A protected pack’s packument `dist.unpackedSize` that is 2× or ≥5 MiB versus the last
identity snapshot writes `identity_size_jump` (no download; first snapshot / missing size
is baseline; trial/Team; Solo 403). Event-driven. Not SIZE-003. Not a Pricing change.
A protected pack that loses npm packument attestations, changes provenance predicateType,
or changes registry signature keyids writes `identity_provenance_lost` /
`identity_provenance_changed` / `identity_signature_changed` (no fetch, no verify, no
signature values stored; first snapshot is baseline; trial/Team; Solo 403). Event-driven.
This is not a Sigstore/attestation adapter. Not a Pricing change.
A protected pack whose `_npmUser` name or trusted-publisher id changes writes
`package_publisher_changed` (no email or oidcConfigId stored; first snapshot / empty
previous is baseline; Solo allowed; unpaid skips). Event-driven. Not a malware verdict.
Not a Pricing change.
GitHub Release `edited` / `prereleased` / `released` rescan when pack assets change (fingerprint
idempotency). `unpublished` / `deleted` are light Watch alerts and never download. Event-driven.
Not a Pricing change.
Generated setup CI lists existing `package.tgz` and `dist/` packs (cap 8), vendors
`.github/actions/nospoilers` to POST each pack to hosted `/api/v1/scan`, and fails
closed if none exist. Source pushes are not unpacked. Reviewable, never merged.
This repository’s GitHub Actions fail-closes every dirty fixture pack, treats inconclusive
encryption fixtures as CLI exit 2, and passes every clean pack after rebuild
(`npm run ci:fixtures`). It also runs `uses: ./` on a clean pack (pass) and a dirty pack
(fail closed). An unclassified fixture fails the gate.
GitHub `repository.deleted` removes the Watch row and does not resurrect it. `renamed` updates
name/URL in place. `privatized` updates the private flag. No extra job.
GitHub App authorization revoke (`github_app_authorization` / `revoked`) drops that user’s
sessions and stored OAuth token. The installation stays. HMAC required. Not coverage-gated.
Sign-out deletes only the current session.
GitHub `installation_target` / `renamed` updates the stored account login in place. No extra
job. HMAC required. Unpaid still updates. Subscribe the App to Installation target.
GitHub `member` added, `fork`, and cheap `push` (`*.map` / `.env` only) enqueue light jobs.
Other member actions and pushes without those paths do not. HMAC required. Unpaid is HTTP 200
with no job. The worker writes Watch alerts for those jobs. The GitHub `public` event is the
same light publicized job. `repository.privatized` updates the Watch row and does not enqueue.
Real GitHub proof is still outstanding.
Public `/docs` is in. Hosted scan, GitHub OAuth, and owner discovery are rate-limited per
address. Receipt verify is a separate budget. GitHub webhooks are not.
Artifact Leads inspect also queues up to eight public npm workspace member packs named
from the repo workspace config. Scanned packs store member names. Members are not
auto-watched. Owner-only.
The hourly poller, after customer work, checks up to eight known npm leads for a new
latest and can run a three-repo discover when GITHUB_DISCOVERY_TOKEN is set. Both skip
if customer jobs are out or three prospect jobs are already queued/running. Owner
POST /api/internal/prospects/feed is the same feed. 404 is not an unpublish. Ignored
and fixed leads are skipped. No seeded companies.
Scan page checks a signed receipt without unpacking (pack hashed in-browser). Coverage ended
still allows that check. Authentic failed-policy/inconclusive is not clean. Watch lists the
linked receipt status on Releases and downloads the signed receipt JSON; unpaid still allowed.
Failed-policy and inconclusive are not allowed to ship. Scan lists docker-save, OCI, VSIX,
CRX, XPI, Chrome ZIP, wheel, sdist, JAR, WAR, nupkg, snupkg, gem, APK, XAPK, AAB, and IPA fixture examples. Layers, bytecode, Python, Ruby,
DEX, Mach-O, and extension payloads are not executed.
Watch Test install reports Members read and optional Contents/PR/Checks write, and warns if
Administration is granted. Missing optional grants do not fail the test. If the App requested
a permission the install has not accepted, Test install names it and links to GitHub’s Accept
page. It does not ask for Administration.
Watch Setup status probes the vendored Action, workflow YAML, and a NoSpoilers check on the
default SHA. Members may read it. Unpaid still allowed. It never invents an alert. The App
cannot see or set whether that check is required.
Watch Scan latest release queues a heavy unpack of that repo’s current GitHub Release pack, not
the git tree, and is not the hourly poller. Tests cover 401/404/403, no-release and no-pack
alerts without download, and a packed asset that fails policy and is not allowed to ship.
Watch one-click GitHub responses are in (make-private / delete latest pack assets / disable a
workflow other than nospoilers.yml). Typed confirm. 409 until Administration (not granted).
Contents write is live on install 158159401 (EmotiveImpact only). Milestone 1
visibility + fixture release scan are proven on EmotiveImpact/nospoilers-throwaway.
`npm run phase1:throwaway` skips `.github/workflows/` (Workflows write is not
requested). Optional next grants: Members read (collaborator Watch), Pull requests
write (reviewable Setup/remediation PRs, never merged), Checks write (hosted
Checks). Do not grant Administration. Do not request Workflows write.
The GitHub connector is the product-repo user token; it 403s writing nospoilers-throwaway.
Stripe and Resend are benched. Do not start the Electron installer worker yet.
Do not start SBOM, Sigstore, or scheduled CDN verification yet.
```

## Cleanup

The SSH private key used for GitHub bootstrap was deleted. Remove `Cursor bootstrap` from GitHub
Deploy keys if it is still present. No GitHub PAT is required.
