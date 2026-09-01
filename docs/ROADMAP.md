# NoSpoilers roadmap

`docs/PRODUCT.md` is the source of truth for product, pricing, and architecture. This file tracks
the immediate operational sequence. The exhaustive expansion plan is
`docs/expansion/NO-SPOILERS-ULTIMATE-PRD.md`; every discussed feature is recorded in
`docs/expansion/FEATURE-INVENTORY.md`.

## Current — 0.1.0

### Proven locally

- Scanner: directories, npm tarballs, ZIP, and Electron `app.asar`.
- Critical detection: maps, embedded source, map URLs, environment files, private keys, and
  high-confidence provider credentials.
- Warnings: credential configs, AI context, internal endpoints/paths, debug artifacts, original
  TypeScript/JSX, and abnormal size.
- Hard defaults: 80 MiB input, 500 MiB unpacked, 25,000 files, 25 MiB/file, 90 seconds.
- CLI, JSON/SARIF, GitHub Action, fixtures, real browser scanning.
- Hosted code: GitHub OAuth/install, HMAC webhooks, Postgres queue, worker, visibility poller,
  release scans, alerts, and Watch desk.
- Event-driven worker wake-up with a 15-minute recovery check.
- Installation billing accounts and unpaid hosted-work enforcement.
- Internal Artifact Leads: public GitHub/npm discovery, metadata-only results, manual outreach state.
- Application runtime on Neon project `NoSpoilers`, branch `production`, database `neondb`.
- Access boundaries document and tests that customer sessions cannot read Artifact Leads.

### Connected but not loop-proven

- Neon Auth remains disabled on purpose.
- GitHub App credentials may exist in local `.env`; the throwaway-repository OAuth → webhook →
  alert loop is still the next proof.

### Missing before launch

- Real throwaway-repository private → public Watch alert and fixture release-asset scan.
- Stripe checkout/subscription webhooks and card-on-file trial.
- Production deployment, email delivery, retries, stale-job recovery, rate limits, and monitoring.
- Secure production cookies, encrypted OAuth tokens, legal/support pages.

## Milestone 0 — prove Neon runtime

Done. Health reports `database.mode: neon` without a URL. Idempotent migrations, a temporary
write/read/delete probe, event-driven enqueue wake, and a 15-minute recovery interval (not 500 ms
empty polling) are in the suite. Access boundaries live in `docs/ACCESS-BOUNDARIES.md`.

## Milestone 1 — prove the GitHub loop

In progress. OAuth user, App install, HMAC webhook 200s (ping, installation, pushes) are real.
Missing: a disposable private → public Watch alert and a fixture release-asset scan. Do not
publicize a product repository. Setup no longer links an arbitrary `installation_id`.

1. Register the GitHub App and add all credentials as Runtime Secrets.
2. Install only on a disposable private repository.
3. Sign in, install, verify ownership, and change private → public.
4. Receive a real Watch alert.
5. Publish a fixture release asset and receive real findings.
6. Verify bad HMAC, duplicate delivery, suspend/uninstall, and poller fallback.

Exit: OAuth → webhook → queue → worker → alert works without manual SQL.

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
- Resend email, retries/backoff, stale-lock recovery, rate limits, readiness checks, logs, failed jobs.
- Serve built frontend and API together or document the production split.
- Secure cookies, encrypted tokens, strong secrets, verified installation setup.
- Privacy, Terms, retention, responsible disclosure, and support.

## Milestone 5 — repeatable acquisition

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
