# Changelog

## [Unreleased]

- Connected the application runtime to Neon `NoSpoilers` / `production` / `neondb`.
- Documented access boundaries; customer sessions cannot read Artifact Leads.
- Allowed the Cloudflare tunnel host so GitHub can reach `/api/webhooks/github`.
- Verify GitHub App setup only links installs the signed-in user actually owns.
- Attach billing accounts to GitHub installation IDs; skip hosted work when coverage has ended.
- Retry failed jobs with backoff and requeue stale locks after a worker crash.
- Encrypt GitHub OAuth tokens at rest, set Secure cookies on https, and cap hosted scans per address.
- Publish Privacy, Terms, retention, disclosure, support, and refund pages.
- Refuse weak `SESSION_SECRET` / webhook secrets on Neon or https; add `/api/ready` and JSON logs.
- Watch public npm packages: scan `latest` on connect, then new versions, mutated tarballs, and dist-tags.
- Record per-file manifests, signed HMAC scan receipts, explicit inconclusive status, and Release Diff.
- Flag nested packs, backup copies, database dumps, internal docs, and escaping symlinks.
- Unpack nested tgz/zip/asar for inspection (never execute) up to three levels.
- Load `.nospoilers.yml` / hosted allowlists (exact rule, expiry, reason) and approve a scan baseline.
- Open a reviewable setup PR for the packed-artifact GitHub Action (never merged). Hosted
  release scans post GitHub Checks with rule/path annotations when Checks write is granted.
- Watch private npm registries: encrypted per-install tokens, same-host HTTPS tarballs, SSRF blocked.
- Discover npm/pnpm/Yarn/Bun workspaces in packed artifacts (members listed, never executed, never auto-watched).
- Flag crash dumps and ELF cores as CRASH-001; extra debug symbols stay DBG-001.
- Hosted scan API: hashed per-install tokens, `POST /api/v1/scan`, signed receipt, bytes deleted.
- Release Ledger foundations: append-only revisions, channels, source revision, stored CI URL.
- Package Identity foundations: verified protect, maintainer snapshots, repo/homepage/shape alerts.
- Install health: GitHub suspend/unsuspend/permission/repo-change alerts; tenant job list on Watch.
- Extra inspect: cloud/service-account, PKCS12, build caches (CACHE-001), broader AI/MCP pack.
- Fair-use hosted unpacks: Solo 1 concurrent heavy job per install, Team/trial 3. Global heavy cap still applies. No scan-credit meter. Event-driven queue. Not advertised as a Pricing change.
- Owner queue health: `/api/internal/queue` returns customer vs prospect counts, stale locks, and oldest wait. No payloads, tenant names, or credential values. Artifact Leads shows the counts.
- Incident response: live GitHub permission test without inventing an incident; alert ack/assign/resolve/reopen; exposure duration; rotation checklist; append-only `alert_events`; tenant JSON export of that activity.
- Multiple GitHub organizations: Watch selects one install; list APIs filter by `installationId`; sibling unpaid or GitHub-suspended orgs do not lock a live one.
- Live permission test reports the last customer job (kind/status/time) and still never inserts an alert.
- Public status page at `/status` from `/api/health` (no tenant data, no connection string).
- Slack incoming webhooks on trial/Team installs: encrypted URL, event-driven alert POST, delivery test that never invents an incident.
- SIEM/custom HTTPS webhooks on trial/Team installs: encrypted URL, private/local/metadata/Slack hosts blocked, DNS-resolved SSRF check, event-driven JSON POST, delivery test that never invents an incident.
- 90-day Team timeline: Watch lists this install’s alerts, acknowledgement activity, and notification deliveries for 90 days. Solo 403, unpaid 402, other tenants empty. No invented rows.
- Team members and roles: first GitHub user on an install is admin; later users are members. Trial/Team can promote, demote, and remove. Solo 403. Unpaid 402. Last admin stays. GitHub suspend does not block. Members keep Watch, ack, and delivery tests. Admins save Slack/SIEM/Jira, registries, scan tokens, allowlists, baselines, and open setup/remediation PRs.
- Jira Cloud tickets on trial/Team installs: `*.atlassian.net` only, encrypted email+token, listed project key, event-driven issue create, delivery test that GETs myself+project and never creates a ticket or Watch alert.
- Team alert routing: min severity, repository, package, teammate assign, and destination. Destinations without a route still receive every alert. Routed tests never invent an incident.
- Team audit log: append-only admin writes, typed confirmation on destructive actions, and a titles-only export of alerts and notification deliveries. Trial/Team. Solo 403. Unpaid 402. Members may read/export. Never stores URLs, emails, tokens, or secret values.
- Package Identity Team signals: bounded lookalike names, dormant resurrection, and release burst/version jump on trial/Team installs. Metadata-only candidate checks. Typed allowlist. Not a malware verdict. No auto advisory/takedown.
- Configurable data retention: 90/180/365 days or keep while this install exists. Lists hide older rows at query time. Append-only evidence is not deleted. Typed confirmation. Solo allowed. Unpaid 402.
- Extra packed formats: VSIX, CRX, XPI, Python wheels, JAR/WAR, NuGet nupkg/snupkg, and Ruby gems. ZIP/tar magic, not extension alone. Encrypted zip and CRX without a ZIP payload are inconclusive. Zip-slip names flag ARC-002 and are not unpacked for content. Not advertised as a Pricing change.
- Docker/OCI image layers: docker save and OCI layout sniff, layer tars and gzip blobs, overlay whiteouts not applied, encrypted layers inconclusive. Not advertised as a Pricing change.
- APK/AAB/IPA: ZIP magic, AndroidManifest/BundleConfig/Payload layout, DEX/Mach-O never executed, signatures not verified, FairPlay not decrypted. Not advertised as a Pricing change.
- Serverless deployment bundles: ZIP magic plus host.json / serverless.yml / .aws-sam / netlify/functions / .vercel/output layout, or `.lambda.zip` name. Handlers never executed. Encrypted zip inconclusive. Not advertised as a Pricing change.
- Production website crawls: HTTPS origin, same-origin JS/CSS/maps plus bounded probes for
  exposed files, credentials, and linked internal paths, SSRF blocked, never executed. SPA
  catch-all HTML is not a secret file. Event-driven enqueue. Not advertised as a Pricing change.
- Sentry/Bugsnag map custody: matching debug ID or release, private lookup, public map absent. Encrypted tokens never returned. Event-driven. Not advertised as a Pricing change. Bugsnag cannot look up a debug ID.
- Automatic remediation PRs: Watch opens a reviewable PR with ignore rules, empty `.nospoilers.yml` (no silent allowlist), bundler hints, a `package.json` `files` snippet, and packed-artifact CI if missing. Never merged. 409 copy-paste when Contents+PR write is missing. Customer ignore/policy/workflow files are not overwritten.
- DOC-001 expanded to architecture/design/rfc/spec/product/month1/feature-inventory/electron, `*.prd.md`, `docs/internal/`, and numbered ADRs.
- Proved the GitHub loop on `EmotiveImpact/nospoilers-throwaway`: webhook → job → Created public alert.
- Added the exhaustive NoSpoilers Ultimate expansion PRD and feature inventory.
- Added NoSpoilers module PRDs for Release Ledger and Package Identity, an internal Disclosure Desk
  PRD, and a standalone Employee Public Footprint PRD.
- Added a revenue and indicative valuation model.
- Register and prove the real GitHub App on a disposable repository.

## [0.1.0] — 2026-09-01

### Added

- Scanner for directories, npm tarballs, ZIP, and Electron asar.
- Source-map, embedded-source, environment, private-key, Git-history, source, and size rules.
- High-confidence token, credential-config, AI-context, internal-location, and debug detectors.
- CLI, JSON/SARIF, committed fixtures, and composite GitHub Action.
- Vite/React Scan, Watch, Pricing, trial, and ended-coverage screens.
- GitHub OAuth/install code, HMAC webhooks, Postgres jobs, release scanning, visibility poller.
- Internal Artifact Leads for public GitHub Release and npm artifacts.
- Scanner resource limits and metadata-only prospect retention.
- Future Electron installer isolation plan covering DMG, EXE/NSIS, AppImage, and MSI.

### Changed

- Replaced 500 ms empty-queue polling with immediate enqueue wake-up and recovery checks.
- Prioritized customer work over internal prospect scans.
- Added Log in and a product frame to the landing page.
- Moved the useful trial/ended mockups into live routes.
- Removed the rejected animated Scan border.
- Adopted the supplied prohibition-O wordmark and matte-black visual system.

### Security

- Public prospect downloads are restricted to HTTPS GitHub/npm hosts.
- Prospect bytes are deleted; source and credential values are not stored.
- Hard defaults: 80 MiB input, 500 MiB unpacked, 25,000 files, 25 MiB/file, 90 seconds.
- Webhook signatures and delivery idempotency are tested.

### Known limitations

- GitHub App OAuth/install/webhooks are live; throwaway private → public and fixture release
  scan are not proven.
- Stripe, production hosting, and email are not built.
- DMG/EXE/MSI/AppImage extraction is not supported.
