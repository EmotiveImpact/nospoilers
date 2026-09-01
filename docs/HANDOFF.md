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
- Thirteen product tables plus `schema_migrations`. Migrations `001_init`, `002_coverage`,
  `003_prospects`, `004_billing_accounts`, `005_watched_packages`, `006_scan_receipts`, and
  `007_policy_exceptions` are applied. Hosted coverage belongs to the GitHub installation
  billing account, not the user row. Scan receipts are append-only HMAC JSON; they store
  manifests and hashes, never source. Development receipts use `RECEIPT_SECRET` (falls back to
  `SESSION_SECRET`). Production signing should move to KMS. Policy exceptions are revoked in
  place (no silent DELETE). Scan baselines supersede the previous active row for a package.
- The application boots with `DATABASE_URL` from `.env` (gitignored). Keep that same URL as a
  Cloud Agent Runtime Secret so new runs do not fall back to PGlite.
- Do not import local PGlite data; Neon starts clean.
- `/api/health` reports `{ database: { mode: "neon" | "postgres" | "pglite" } }` and never the URL.

## Runtime facts

- Without `DATABASE_URL`, development uses PGlite under `data/nospoilers`.
- API routes wake the worker immediately after enqueue. The 15-minute timer is recovery only.
  Failed jobs retry with backoff; stale running locks are requeued. GitHub OAuth tokens are
  encrypted at rest. Hosted `/api/scan` is rate-limited per address. HTTPS origins set Secure cookies.
  Neon and https origins refuse to boot with short or default `SESSION_SECRET` / webhook secrets.
  `/api/ready` pings the database. Logs are JSON lines (`event`, `level`, `ts`) with secrets redacted.
- Public Privacy, Terms, Retention, Disclosure, Support, and Refunds pages are live.
- Customers can watch public npm packages on a covered install. Connecting a name scans `latest`;
  the hourly poller and Watch “Check now” enqueue new versions, mutated tarballs, and dist-tag moves.
  Covered npm and GitHub release scans persist a signed receipt and can diff the last two. The
  15-minute worker timer is still recovery only — enqueue wakes the worker.
- Customers can add expiring, attributable allowlist exceptions (exact rule + optional path glob)
  and approve a packed receipt as the shipping baseline. Hosted scans apply those exceptions
  before minting a receipt. CLI and the GitHub Action load `.nospoilers.yml` when present.
- The hourly GitHub visibility poller is separate and remains enabled.
- Artifact Leads is `/internal/prospects`. Create a new long random `ADMIN_TOKEN`; do not reuse the
  prior temporary local token. `GITHUB_DISCOVERY_TOKEN` is optional.
- Prospecting scans public GitHub Release assets and root npm packages. It does not clone source,
  retain bytes, auto-contact maintainers, or scan Electron installers over the limit.

## Critical truth

The scanner, UI, and Neon runtime work. The commercial hosted product is not launch-ready:

- `EmotiveImpact/nospoilers-throwaway` produced a real Watch alert: GitHub `repository.created`
  (HTTP 200) → job `repo_created_public` done → “was created public”. Fixture release scan is not
  proven yet.
- Stripe, production deployment, and real notification delivery do not exist.

Do not describe these as complete because the UI exists.

## Exact next prompt

```text
Continue NoSpoilers from the repository handoff. Read docs/PRODUCT.md,
docs/expansion/NO-SPOILERS-ULTIMATE-PRD.md, docs/expansion/FEATURE-INVENTORY.md,
docs/ROADMAP.md, docs/HANDOFF.md, docs/ACCESS-BOUNDARIES.md, and CHANGELOG.md first.
Phase 0 is done. Milestone 2 (installation billing + unpaid enforcement) is done.
Legal/support pages and strong secret checks are done.
Public npm package watching (latest tarball) is in.
Release manifests, signed receipts, inconclusive status, and Release Diff are in.
Nested packs, backups, dumps, internal docs, and escaping symlinks are flagged.
`.nospoilers.yml`, expiring allowlists, and baseline approval are in.
Milestone 1 visibility alert is proven on EmotiveImpact/nospoilers-throwaway (created public).
Still needed: a GitHub Release on that repo with fixtures/sourcemap.tgz attached.
Do not start Stripe or the Electron installer worker yet.
```

## Cleanup

The SSH private key used for GitHub bootstrap was deleted. Remove `Cursor bootstrap` from GitHub
Deploy keys if it is still present. No GitHub PAT is required.
