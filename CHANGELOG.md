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
