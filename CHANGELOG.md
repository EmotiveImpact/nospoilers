# Changelog

Ship log. Capability status lives in [`docs/STATUS.md`](docs/STATUS.md). Every discussed row is
[`docs/expansion/FEATURE-INVENTORY.md`](docs/expansion/FEATURE-INVENTORY.md).

## [Unreleased]

- Fixed Coverage's Open repository action to open the selected repository on GitHub. Inventory rows now say View details, and check configuration remains a separate action.
- Redesigned the Alerts footer with a compact count/pagination row and a separate readable retained-history note; pagination is unavailable during transitions or failed requests.
- Corrected the existing GitHub connection's account name to use the app's light foreground on its dark panel.
- Added secure reconnection for an existing unbound personal GitHub App installation. The live
  OAuth user must own the installation account, the destination requires organisation/workspace
  admin authority, and the atomic binder still rejects claimed installations and repository moves.
- Repaired the production GitHub webhook secret across GitHub, Vercel and Railway. Post-rotation
  deliveries return 200 and are retained in the shared Neon pending-event inbox until binding.
- Completed bounded live Vercel Sandbox checks for a clean archive, fail-closed encrypted input,
  denied egress, timeout and stopped cleanup.
- Added the provider-neutral identity foundation in migration `123_product_identity`. Trusted
  issuer/subject pairs map to stable NoSpoilers users without merging accounts by email.
- Moved GitHub OAuth credentials into separate connector-account storage. Existing GitHub users
  retain their IDs, workspaces and evidence; provider-neutral sessions survive GitHub connector
  revocation.
- Added stable `ADMIN_USER_ID` authorization for the private Artifact Leads and Disclosure Desk,
  retaining `ADMIN_TOKEN` and transitional `ADMIN_GITHUB_LOGIN` access.
- Selected Neon Managed Better Auth for ordinary customer login and documented WorkOS as a later
  enterprise SSO/SCIM adapter. Neither provider is represented as live before its hosted flow passes.
- Configured the hosted scan split as one trusted Railway coordinator plus a fresh, isolated Vercel
  Sandbox microVM per untrusted scan. A live clean probe and worker preflight pass; remaining
  hostile-input/egress/interruption checks stay open.
- Verified that the fresh Vercel and Railway services point to the same Neon project without
  retaining or printing the compared credentials.
- Added [authentication and worker architecture](docs/AUTH-ENTERPRISE-AND-WORKERS.md) and the
  [bugs and fixes register](bugsandfixes.md).
- Final source verification for this increment: **1,665/1,665 tests across 271 files**, typecheck,
  frontend/API builds, lint with the existing warnings and diff check.
- Documentation map consolidated: `docs/STATUS.md` answers what is built vs live;
  `docs/ROADMAP.md` is only what is left; `docs/HANDOFF.md` is live host facts.

## [0.1.1] — 2026-09-04

Specified product code after 0.1.0. Launch (Stripe keys, Resend keys, Railway, domain) is still
dark. Grouped here so this file is not a second inventory.

### Hosted loop and coverage

- Neon runtime, event-driven worker, LISTEN reconnect, unpaid-install kill, legal pages.
- GitHub OAuth/install/webhooks proven on `EmotiveImpact/nospoilers-throwaway` (created public,
  cheap push, private → public, fixture `release_scan`, App-generated setup PR).
- Public and private npm watch, website crawl + ownership proof, deploy trigger, map custody.
- Hosted scan API, receipts, allowlists, baselines, SIZE-003, fair-use caps.
- Stripe Checkout/portal/webhooks and Resend email adapters (503 without keys).
- Vercel web/API + `railway.toml` worker split. Domain not cut over.

### Watch

- 2B monolith desk, extracted screens, sidebar collapse, queue track, bento overview.
- Linear product-frame chrome, then stage-only comps (`19`–`21`). Live frame wraps the desk;
  shot C is the stage recipe.
- Team roles, invites, Slack/SIEM/Jira/PagerDuty, routing, audit, timeline, retention.
- Incident ack/assign/resolve. One-click GitHub responses 409 without Administration.

### Modules

- Release Ledger: revisions, delivery verify, governance, `/verify/:token`, attestation
  presence, signing policy. No Sigstore verify. No scheduled CDN.
- Package Identity: protect, lookalikes, namespace watch, evidence/advisory, risk score.
- Disclosure Desk on Artifact Leads (owner-only, nothing mailed).

### Scanner

- Nested unpack for zip-family, images, mobile, serverless. Extra inspect rules.
- Electron installers classified and skipped (isolated worker still on ice).

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

### Known limitations (0.1.0)

These were true on 1 September 2026. See 0.1.1 and [`docs/STATUS.md`](docs/STATUS.md) for what
closed later.

- GitHub App OAuth/install/webhooks were live; throwaway private → public and fixture release
  scan were not yet proven.
- Stripe, production hosting, and email were not built.
- DMG/EXE/MSI/AppImage extraction is not supported (still true; worker skips them).
