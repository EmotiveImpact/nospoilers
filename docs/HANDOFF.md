# Next-agent handoff

Read in this order:

1. `docs/PRODUCT.md` — product source of truth
2. `docs/expansion/NO-SPOILERS-ULTIMATE-PRD.md` — complete product and phased plan
3. `docs/expansion/FEATURE-INVENTORY.md` — exhaustive feature accounting
4. `docs/ROADMAP.md` — immediate milestones and exit criteria
5. `CHANGELOG.md` — completed work
6. `README.md` — operation and GitHub App checklist
7. `docs/ELECTRON.md` — installer work intentionally on ice
8. `docs/MONTH1.md` — evidence-led acquisition
9. `docs/products/README.md` — separate-product boundaries and PRDs

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
- Nine tables and migrations `001_init`, `002_coverage`, `003_prospects` are applied.
- `DATABASE_URL` was saved as a Runtime Secret, but the old run could not receive it.
- Do not import local PGlite data; Neon starts clean.

## Runtime facts

- Without `DATABASE_URL`, development uses PGlite under `data/nospoilers`.
- API routes wake the worker immediately after enqueue. The 15-minute timer is recovery only.
- The hourly GitHub visibility poller is separate and remains enabled.
- Artifact Leads is `/internal/prospects`. Create a new long random `ADMIN_TOKEN`; do not reuse the
  prior temporary local token. `GITHUB_DISCOVERY_TOKEN` is optional.
- Prospecting scans public GitHub Release assets and root npm packages. It does not clone source,
  retain bytes, auto-contact maintainers, or scan Electron installers over the limit.

## Critical truth

The scanner and UI work. The commercial hosted product is not launch-ready:

- GitHub App secrets do not exist.
- No real OAuth/install/webhook/release loop has been performed.
- Coverage is on users instead of installation billing accounts.
- Unpaid webhook/worker/poller enforcement is incomplete.
- Stripe, production deployment, and real notification delivery do not exist.

Do not describe these as complete because the UI exists.

## Exact next prompt

```text
Continue NoSpoilers from the repository handoff. Read docs/PRODUCT.md,
docs/expansion/NO-SPOILERS-ULTIMATE-PRD.md, docs/expansion/FEATURE-INVENTORY.md,
docs/ROADMAP.md, docs/HANDOFF.md, and CHANGELOG.md first. Execute Phase 0 only: verify DATABASE_URL
connects the application to the existing Neon NoSpoilers project without importing PGlite data.
Reset the single server on port 4347, run idempotent migrations, test a temporary database
transaction, and prove an API-enqueued job wakes immediately without sub-second idle polling.
Commit and push any required fixes. Then report the remaining user action for registering the real
GitHub App; do not start Stripe or the Electron installer worker yet.
```

## Cleanup

The SSH private key used for GitHub bootstrap was deleted. Remove `Cursor bootstrap` from GitHub
Deploy keys if it is still present. No GitHub PAT is required.
