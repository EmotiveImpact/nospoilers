# NoSpoilers roadmap

`docs/PRODUCT.md` is the source of truth for product, pricing, and architecture. This file tracks
the immediate operational sequence. The exhaustive expansion plan is
`docs/expansion/NO-SPOILERS-ULTIMATE-PRD.md`; every discussed feature is recorded in
`docs/expansion/FEATURE-INVENTORY.md`.

## Current — 0.1.0

### Proven locally

- Scanner: directories, npm tarballs, ZIP, VSIX, CRX, XPI, Chrome extension ZIP, wheels, Python sdist, JAR/WAR, NuGet packs, Ruby gems, Docker/OCI image archives, APK/AAB/IPA, serverless Lambda/Azure/Netlify/Vercel zips, and Electron `app.asar`.
- Critical detection: maps, embedded source, map URLs, environment files, private keys, and
  high-confidence provider credentials.
- Warnings: credential configs, AI context, internal endpoints/paths, debug artifacts, original
  TypeScript/JSX, abnormal size, nested packs, backups, internal docs, and build caches.
- Additional critical paths: database dumps, crash dumps/minidumps/ELF cores, and escaping
  symlinks and archive entry paths (ARC-002). Nested tgz/zip/asar/vsix/crx/xpi/whl/jar/nupkg/gem
  and Docker/OCI layers, APK/AAB, IPA, and serverless zips are unpacked for inspection (never executed) up to three
  levels.   Encrypted zip, CRX wrappers without a ZIP payload, and encrypted image layers are
  inconclusive. Scan lists `inconclusive.encrypted.zip`, `inconclusive.crx`, and
  `inconclusive.encrypted.oci.tar`. Overlay whiteouts are not applied. APK and Apple signatures are not verified.
- Hard defaults: 80 MiB input, 500 MiB unpacked, 25,000 files, 25 MiB/file, 90 seconds.
- CLI, JSON/SARIF, GitHub Action, fixtures, real browser scanning.
- Product CI: after rebuilding fixtures, fail-closes every dirty pack, treats `inconclusive.*`
  as CLI exit 2, and passes every clean pack plus `workspace.tgz`. Dogfoods the GitHub Action
  on a clean pack (pass) and a dirty pack (fail closed). An unclassified fixture fails the gate.
- Hosted code: GitHub OAuth/install, HMAC webhooks, Postgres queue, worker, visibility poller,
  release scans, alerts, and Watch desk.
- Event-driven worker wake-up with a 15-minute recovery check.
- Failed-job retry with backoff and stale-lock recovery after a worker crash.
- Installation billing accounts and unpaid hosted-work enforcement.
- Privacy, Terms, retention, responsible disclosure, support, and refund pages.
- Strong secret-length checks on Neon/https boot; `/api/ready` database ping; JSON logs.
- Public npm package watching: connect a pack, scan `latest`, detect the next version.
  A later registry 404 after a recorded version is a Watch `package_unpublished` fact
  (no download, not a malware verdict). A 5xx/network error is not an unpublish.
- Prerelease npm channels: `next`/`beta`/`canary`/`rc`/`alpha`/`preview` tarballs unpack when
  those tags point at another version (cap three extras). Other dist-tag moves stay tag-only
  alerts and do not download. Event-driven. Not a Pricing change.
- GitHub Release `edited` / `prereleased` / `released` enqueue another pack scan only when
  attached pack assets change. `unpublished` and `deleted` are light alerts and never download.
  Event-driven. Not a Pricing change.
- Private npm registries: encrypted per-install tokens, same-host tarball downloads only.
- Release manifests (path/size/SHA-256), signed HMAC scan receipts, explicit inconclusive
  status, and Release Diff of the last two receipts on a watched package.
- SIZE-003: a later hosted pack that is twice as large, or at least 5 MiB larger unpacked,
  versus the previous receipt or approved baseline. First scans stay SIZE-001/002 only.
  Warn, not a failed receipt. Allowlistable. GitHub Checks get a warning annotation.
- `.nospoilers.yml` / hosted allowlists (exact rule, expiry, reason) and approved scan baselines.
- App-generated setup PR (reviewable, never merged) and hosted GitHub Checks on release scans.
  Generated CI lists existing `package.tgz` and `dist/` packs (cap 8), vendors
  `.github/actions/nospoilers` to POST each pack to hosted `/api/v1/scan`, and fails closed
  if none exist. Source pushes are not unpacked. Watch and the setup PR body tell maintainers to
  mark the NoSpoilers check required; the App does not set branch protection. Watch Setup
  status probes Action/workflow presence and whether a NoSpoilers check ran; required stays
  unknown. Live GitHub writes
  skip with copy-paste files /
  no Check until the App is granted Contents write, Pull requests write, and Checks write. Do not
  grant Administration.
- Packed npm/pnpm/Yarn/Bun workspace discovery: list roots and members from package.json /
  pnpm-workspace.yaml / lockfile presence. Never execute. Never auto-watch discovered names.
- Hosted scan API: hashed `nsp_` tokens per install; `POST /api/v1/scan` returns a signed receipt
  and deletes the upload. Unpaid mint/scan return 402. This repository’s local Action remains
  `uses: ./`. Customer Setup CI uses the vendored hosted-scan Action. Watch shows the current
  `APP_BASE_URL` as `NOSPOILERS_API_URL` when signed in; loopback/HTTP is not reachable from
  GitHub-hosted runners.
- Release Ledger foundations: append-only `release_revisions` with stable/beta/canary channels,
  SHA-256/SHA-512 identity, packed size, media type, source revision, stored HTTPS CI run URL (never fetched), and a
  Watch Releases view with linked receipt status (`passed` / `failed-policy` / `inconclusive`).
  Failed-policy and inconclusive are not clean. Digest mismatch appends a new row and an
  explainable alert. An install admin can attach an HTTPS delivery URL and verify it now
  (stream-hash, no stored bytes, not the hourly poller). Public GitHub Release download
  URLs and public npm tarball URLs attach when the revision is sealed. Expected hops
  are GitHub’s asset CDN, same-bucket S3, and same-account R2; other hosts are not
  fetched. Each verify records hop hosts, a cache token, and a host-derived region.
  `nospoilers verify --receipt` can stream-hash a `--url` the same way.
  Trial and Team admins approve a passing revision to ship (typed coordinate; the
  delivery-URL attacher cannot approve that row) or reject it. Legal hold keeps a
  revision listed after the retention window; another admin must release the hold.
  Members export the ledger JSON (query strings and pack bytes omitted). Solo 403.
  Unpaid 402. An install admin can publish `/verify/:token` for a sealed revision
  (Solo allowed; unpaid 402 to change; public GET is redacted and does not enqueue
  verify). Development
  receipts stay HMAC `dev-hmac`; production signing should move to KMS.
- Package Identity foundations: customers protect a watched npm pack only when the npm scope or
  GitHub repository field matches this install. Append-only identity snapshots record maintainers
  (names only), repository, homepage, bin names, install lifecycle scripts, `_npmUser` publisher
  name, and trusted-publisher id. Changes alert with before/after facts and never a malware
  verdict. Email and OIDC config ids are not stored. First snapshot / empty previous
  publisher is baseline. Solo allowed.
- Package Identity batch import: `POST /api/protections/import` protects owned npm names from
  a list (cap 20). Metadata only. Arbitrary packs are not watched. Watch cap 25. Solo
  allowed. Unpaid 402. Not other registries. Not takedown or a public advisory.
- Install health: covered installs get Watch alerts for GitHub App suspend, unsuspend,
  permission changes, and repository add/remove. Uninstall still drops the tenant. Watch
  lists this install's recent jobs (no payloads, no prospect scans). GitHub suspend is not
  treated as unpaid coverage.
- Extra inspect: Azure/GCP service-account documents, PKCS12, terraform state, build caches
  (CACHE-001), and additional AI/MCP agent files. Values are not copied into reports.
- Fair-use hosted unpacks: Solo one concurrent heavy job per install; Team and trial three.
  Daily cap Solo 8 / Team and trial 24 heavy unpacks per UTC day. Watch shows warning or
  paused copy, not remaining credits. Owner queue lists aggregate usage counts.
  Global heavy cap still applies. Job lists are counts, not scan credits. Not a Pricing change.
- Watch one-click GitHub responses: make-private, delete latest Release pack assets, disable
  a workflow that is not `.github/workflows/nospoilers.yml`. Install admin, typed confirm.
  Unpaid 402, GitHub suspend 409, members 403. 409 until Administration (not granted).
  Contents write is not enough. Success is audit plus a confirmed Watch alert, not a
  discovered incident.
- Owner queue health: Artifact Leads shows customer vs prospect queue counts, stale locks,
  oldest wait, and daily unpack aggregates. Payloads are not listed. Not a customer page.
- Incident response: live GitHub permission test without inventing an incident; names
  App-requested permissions the install has not accepted and links to GitHub Accept
  (never Administration); Watch acknowledgement, assignment to install members, resolution
  notes, reopen, exposure duration, and a credential/source-map rotation checklist.
  `alert_events` are append-only.
- Multiple GitHub organizations: Watch switches installs; coverage and GitHub suspend
  apply to the selected org only. Live permission tests include the last customer job.
- Public `/status` page from `/api/health` (no tenant data, no connection string).
- Slack incoming webhooks for trial/Team: encrypted URL, event-driven delivery, test that
  never invents an incident. Email still waits on Resend.
- SIEM HTTPS webhooks for trial/Team: encrypted URL, private/local/metadata/Slack hosts
  blocked, DNS-resolved SSRF check, event-driven JSON POST, test that never invents an incident.
- Jira Cloud tickets for trial/Team: `*.atlassian.net` only, encrypted email+token, listed
  project key, event-driven issue create, test that GETs myself+project and never creates a
  ticket or Watch alert.
- PagerDuty Events API for trial/Team: `events.pagerduty.com` only, encrypted routing key,
  event-driven trigger, test that POSTs a change event and never creates an incident or
  Watch alert.
- Team alert routing: min severity, repository, package, teammate assign, and destination.
  Destinations without a route still receive every alert. Routed tests never invent an incident.
- Team audit log: append-only admin writes, typed confirmation on destructive actions, and a
  titles-only export of alerts and notification deliveries. Trial/Team. Solo 403. Unpaid 402.
  Members may read/export. Never stores URLs, emails, tokens, or secret values.
- Package Identity Team signals: bounded lookalike candidates (homoglyph, adjacent-key,
  separator, token-order, scope confusion, edit-distance; cap 40), dormant resurrection after
  180 days, burst/major-jump cadence alerts, new dependencies that point at a package
  first published within 14 days, and packument unpacked-size jumps (2× or ≥5 MiB versus
  the last snapshot’s claimed `dist.unpackedSize`, no download), and npm attestation
  presence / registry signature keyid changes (packument fields only; no fetch, no
  verify, no stored signature values). Watch shows a deterministic 0–100 signal
  total on a protected pack, decomposed into those facts plus open event alerts.
  Metadata-only candidate
  and dependency-name checks. Public packuments (including 404s) are cached for one
  hour; private-registry tokens bypass the cache; Watch Check now / connect / protect /
  import fetch the watched name fresh; the hourly poller skips lookalikes checked within
  the last hour. Live Neon gates on `158159401`: unauth 401, unknown package 404,
  watch list empty, no open jobs, tunnel matched. Typed
  allowlist. Trial/Team. Solo 403. Unpaid 402. Not a malware verdict. No auto advisory/takedown.
- Package Identity human-reviewed evidence: trial/Team admin assembles a frozen takedown
  pack for a protected npm name and may publish `/advisory/:token`. Members may
  download. Solo 403. Unpaid 402 to change; an already-published page still reads.
  Public page is hosts and lookalike names only. Never sent to npm or GitHub. Not a
  malware verdict. Not other registries.
- Package Identity namespace watchlists: trial/Team admin watches the npm scope
  that matches this GitHub login. Public search only. First snapshot is baseline.
  Later new names alert without download or auto-watch. Solo 403. Unpaid 402.
  Live on `158159401`: `@emotiveimpact` POST 201 → empty baseline `namespace_check`
  done, no `npm_scan`, typed DELETE left 0 rows.
- 90-day Team timeline: this install’s alerts, acknowledgement activity, and notification
  deliveries for the install list window (default 90 days). Solo 403. Unpaid 402. No invented rows.
- Configurable data retention: 90, 180, or 365 days, or keep while this install exists.
  Query-time lists. Append-only evidence is not deleted. Typed confirm. Solo allowed.
  Unpaid 402. Members may read.
- Extra packed formats: VSIX, CRX, XPI, Chrome extension ZIP, wheels, Python sdist, JAR/WAR, NuGet, Ruby gems. ZIP/tar magic.
  Encrypted zip and CRX without ZIP are inconclusive. Zip-slip is ARC-002 and is not unpacked
  for content. Scan accepts those extensions and includes VSIX, CRX, XPI, Chrome ZIP, wheel, sdist, JAR, nupkg,
  and gem fixture examples. Payloads are not executed. Not a Pricing change.
- Docker/OCI image layers: docker save (`manifest.json` + `layer.tar`) and OCI layout (`oci-layout` /
  `blobs/sha256`). MIME/magic, not extension. Overlay whiteouts are not applied. Encrypted layers
  are inconclusive. Image signatures are not verified. Scan includes docker-save and OCI
  fixture examples. Layers are not executed.
  Not a Pricing change.
- APK/AAB/IPA: ZIP magic plus AndroidManifest/BundleConfig/`Payload/*.app` layout. DEX, native
  libraries, and Mach-O are never executed. APK/Apple signatures are not verified. Encrypted zip
  is inconclusive. FairPlay-encrypted Mach-O is not decrypted. Scan includes APK, AAB, and IPA fixture examples.
  Not a Pricing change.
- Serverless deployment bundles: ZIP magic plus `host.json`, `serverless.yml`, `.aws-sam`,
  `netlify/functions`, or `.vercel/output` layout, or a `.lambda.zip` name. Handlers, bootstraps,
  and native binaries are never executed. Encrypted zip is inconclusive. Scan includes a Lambda
  zip fixture example. Not a Pricing change.
- Production website crawls: HTTPS origin, same-origin JS/CSS/maps plus bounded probes for
  exposed files, credentials, and linked internal paths, private/local/metadata hosts blocked,
  never executed. Connect enqueues immediately. Hourly poller enqueues. Not a Pricing change.
- Sentry/Bugsnag map custody: matching debug ID (Sentry) or release version (Bugsnag), private
  lookup, public map absent. Encrypted tokens. Event-driven. Not a Pricing change. Bugsnag cannot
  look up a debug ID.
- Team members and roles: first GitHub user on an install is admin; later users are members.
  Trial/Team role changes. Solo 403. Unpaid 402. Last admin stays. GitHub suspend does not
  block. Members keep Watch/ack/test. Admins save Slack/SIEM/Jira/PagerDuty, routes, registries, tokens, allowlists,
  baselines, and open setup/remediation PRs. Trial/Team can invite by GitHub login (no email;
  Resend is benched). They get that role on sign-in if GitHub already lists them on this App.
  First-user-admin still wins if a member invite would leave zero admins.
- Automatic remediation PRs: ignore rules, empty `.nospoilers.yml`, bundler hints, `files`
  snippet, and packed-artifact CI on branch `nospoilers/remediate`. Reviewable, never merged.
  Customer files are not overwritten. 409 copy-paste until Contents write and Pull requests
  write. Do not grant Administration.
- Internal docs (DOC-001): architecture/design/rfc/spec/product/month1/feature-inventory/
  electron, `*.prd.md`, `docs/internal/`, and numbered ADRs.
- Internal Artifact Leads: public GitHub/npm discovery, metadata-only results, nested
  public workspace member packs (cap 8 queued / 40 listed names, never auto-watched),
  hourly npm version feed and one saved campaign (or the default search) for
  a three-repo scheduled discover behind customer jobs,
  manual outreach state, Disclosure Desk Phase 2 minus send plus internal
  workflow (verification, duplicates, templates, vendor channel, do-not-contact,
  outcomes, vendor replies, encrypted attachments, assignment, review before
  `contacted`, redacted reports, draft preview, simulated acknowledgement,
  fix-version rescan; expired attachment and notes ciphertext is zeroed on
  schedule; nothing sent), and
  owner-only notifications for verified critical findings and missed deadlines
  (never mailed), owner-only researcher workload as case counts per
  assignee (no time tracking), and owner-only webhook/Jira destinations
  that file a redacted verified case after typed confirm (test never
  invents an incident). Live Neon: unauth/`not-admin` 401; owner
  200 counted the prettier and left-pad cases; tunnel matched.
- Application runtime on Neon project `NoSpoilers`, branch `production`, database `neondb`.
- Access boundaries document and tests that customer sessions cannot read Artifact Leads.
- GitHub App authorization revoke: HMAC webhook drops that user’s sessions and stored OAuth
  token. The installation stays. Coverage does not gate this. Sign-out deletes only the current
  session.
- Public `/docs` (Watch, packed scans, coverage, never execute/retain source). Stripe and Electron
  are not claimed live.
- Rate limits: hosted scan, GitHub OAuth start/callback, and owner discovery per address.
  GitHub webhooks stay unlimited so deliveries retry.

### Connected but not loop-proven

- Neon Auth remains disabled on purpose.
- Throwaway repo Watch alerts are proven (`repo_created_public`, cheap `.env`/`.map` push,
  and fixture `release_scan`).

### Missing before launch

- Stripe checkout/subscription webhooks and card-on-file trial (benched).
- Production deployment, email delivery (Resend, benched), and monitoring.

## Milestone 0 — prove Neon runtime

Done. Health reports `database.mode: neon` without a URL. Idempotent migrations, a temporary
write/read/delete probe, event-driven enqueue wake, and a 15-minute recovery interval (not 500 ms
empty polling) are in the suite. Access boundaries live in `docs/ACCESS-BOUNDARIES.md`.

## Milestone 1 — prove the GitHub loop

Done for the hosted GitHub loop. OAuth user, App install, HMAC webhook 200s, and real Watch
alerts are proven. `EmotiveImpact/nospoilers-throwaway` was created public, then seeded with
`throwaway/` (workflow YAML skipped — that needs a Workflows permission we will not request)
and `fixtures/sourcemap.tgz` on tag `phase1-fixture`. GitHub delivered `release.published`
(HTTP 200) → job `release_scan` done → alert **Spoilers in EmotiveImpact/nospoilers-throwaway
phase1-fixture** and a `failed-policy` receipt (MAP-001/002/003). Contents write is live on
this install only. Do not grant Administration. Do not publicize a product repository.
Stripe and Resend are benched.

1. Register the GitHub App and add all credentials as Runtime Secrets.
2. Install only on a disposable private repository.
3. Sign in, install, verify ownership, and change private → public.
4. Receive a real Watch alert.
5. Publish a fixture release asset and receive real findings.
6. Verify bad HMAC, duplicate delivery, suspend/uninstall, and poller fallback.

Exit: OAuth → webhook → queue → worker → alert works without manual SQL. Visibility alert
(`repo_created_public`) and fixture release scan (`release_scan` + failed-policy receipt)
are done.

## Milestone 2 — make coverage commercially correct

Done. Billing accounts attach to GitHub installation IDs. New installs start a 14-day trial.
Unpaid or suspended installs still receive webhook HTTP 200, but enqueue, worker, visibility
poller, hosted upload, and latest-release scan skip their work. Anonymous `POST /api/scan`
stays a size-limited acquisition surface (80 MiB). Stripe is still Milestone 3.

Exit: unpaid installations cannot receive hosted coverage through any path.

## Milestone 3 — charge on our site

1. Create Stripe monthly/yearly Solo and Team prices.
2. Collect payment method through Checkout before the 14-day trial.
3. Store customer, subscription, plan, status, and period end on the billing account.
4. Process Stripe lifecycle webhooks idempotently.
5. Connect Pricing/Subscribe to Checkout and Billing Portal.
6. Test expiry, failed payment, cancellation, renewal, and reactivation.

Exit: customer one can pay without GitHub Marketplace. Marketplace is optional after 100 installs.

## Milestone 4 — production reliability

- Railway web/API and normal worker; Neon Postgres; Cloudflare DNS.
- Before customers: Railway warning near $25 and hard stop near $50; review before production.
- Resend email. Serve built frontend and API together or document the production split.

## Milestone 5 — repeatable acquisition

Done except anonymized aggregate research (still after review). Scheduled
discovery, npm version feed, nested workspace discovery, Disclosure Desk
Phase 2 minus send (templates, vendor channel, do-not-contact, outcomes,
internal deadline reminders), conversion attribution, and owner-only
verified-critical notifications are in. Outreach stays manual. Nothing is mailed.

- Scheduled public artifact discovery and npm version monitoring.
- Nested workspace package discovery.
- Internal notification only for verified critical findings.
- Human verification and outreach remain manual.
- Track finding → reply → trial → activation → paid → retained.

## Milestone 6 — Electron installer worker (on ice)

Follow `docs/ELECTRON.md`. Build only after paying demand. Planned order: DMG, Windows EXE/NSIS,
AppImage, MSI. Each installer runs in one disposable, restricted container job.

## Locked decisions

- Charge through Stripe on our site from customer one.
- Solo $29/month; Team $99/month; 14-day trial; yearly is 10 months for 12.
- Sell coverage, not scan credits.
- Hosted GitHub/release coverage is the bill; CLI is distribution.
- No public Enterprise plan until a customer asks.
- Never retain source or include credential values in reports.
