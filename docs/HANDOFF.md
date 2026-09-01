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
- Nine tables and migrations `001_init`, `002_coverage`, `003_prospects` are applied.
- The application boots with `DATABASE_URL` from `.env` (gitignored). Keep that same URL as a
  Cloud Agent Runtime Secret so new runs do not fall back to PGlite.
- Do not import local PGlite data; Neon starts clean.
- `/api/health` reports `{ database: { mode: "neon" | "postgres" | "pglite" } }` and never the URL.

## Runtime facts

- Without `DATABASE_URL`, development uses PGlite under `data/nospoilers`.
- API routes wake the worker immediately after enqueue. The 15-minute timer is recovery only.
- The hourly GitHub visibility poller is separate and remains enabled.
- Artifact Leads is `/internal/prospects`. Create a new long random `ADMIN_TOKEN`; do not reuse the
  prior temporary local token. `GITHUB_DISCOVERY_TOKEN` is optional.
- Prospecting scans public GitHub Release assets and root npm packages. It does not clone source,
  retain bytes, auto-contact maintainers, or scan Electron installers over the limit.

## Critical truth

The scanner, UI, and Neon runtime work. The commercial hosted product is not launch-ready:

- No real OAuth/install/webhook/release loop has been performed on a disposable repository.
- Coverage is on users instead of installation billing accounts.
- Unpaid webhook/worker/poller enforcement is incomplete.
- Stripe, production deployment, and real notification delivery do not exist.

Do not describe these as complete because the UI exists.

## Exact next prompt

```text
Continue NoSpoilers from the repository handoff. Read docs/PRODUCT.md,
docs/expansion/NO-SPOILERS-ULTIMATE-PRD.md, docs/expansion/FEATURE-INVENTORY.md,
docs/ROADMAP.md, docs/HANDOFF.md, docs/ACCESS-BOUNDARIES.md, and CHANGELOG.md first.
Phase 0 (Neon runtime) is done. Execute Milestone 1: prove the real GitHub App on a disposable
private repository (OAuth → install → webhook → queue → worker → Watch alert, then a fixture
release scan). Do not start Stripe or the Electron installer worker yet.
```

## Cleanup

The SSH private key used for GitHub bootstrap was deleted. Remove `Cursor bootstrap` from GitHub
Deploy keys if it is still present. No GitHub PAT is required.
