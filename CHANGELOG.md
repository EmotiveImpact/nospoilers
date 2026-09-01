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
- Incident response: live GitHub permission test without inventing an incident; alert ack/assign/resolve/reopen; exposure duration; rotation checklist; append-only `alert_events`; tenant JSON export of that activity.
- Multiple GitHub organizations: Watch selects one install; list APIs filter by `installationId`; sibling unpaid or GitHub-suspended orgs do not lock a live one.
- Live permission test reports the last customer job (kind/status/time) and still never inserts an alert.
- Public status page at `/status` from `/api/health` (no tenant data, no connection string).
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
