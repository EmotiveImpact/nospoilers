# NoSpoilers handoff

Read [PRODUCT.md](PRODUCT.md) first. Then this file, [ROADMAP.md](ROADMAP.md), and [CHANGELOG.md](../CHANGELOG.md).

## What is running

Single TypeScript package. Vite UI on port **4347** with the Hono API mounted at `/api` (`src/plugin.ts`). Production database is Neon, not PGlite.

| Piece | Where |
| --- | --- |
| Scanner | `src/scanner/` |
| Hosted API + queue | `src/server/` |
| Schema | `src/server/schema.sql` (migrations `001_init`, `002_coverage`, `003_prospects`) |
| Worker | `src/server/worker.ts` — `tick()` on enqueue; `setInterval(WORKER_INTERVAL_MS)` recovery only |
| Visibility backstop | `src/server/poller.ts` — `POLL_INTERVAL_MS` default 1 hour |

`GET /api/health` reports `database.driver` (`neon` \| `pglite` \| `postgres`) and worker intervals. It never returns connection secrets.

## Database

- Neon project: **NoSpoilers** (`raspy-voice-63712580`)
- Branch: **production** (default)
- Database: **neondb**
- Neon Auth: **disabled**. Login is GitHub App OAuth.
- Nine public tables: `schema_migrations`, `users`, `sessions`, `installations`, `installation_users`, `repos`, `jobs`, `alerts`, `prospects`
- Do not import `data/` PGlite files into Neon.

`DATABASE_URL` in the environment (Cursor runtime secret) wins over `.env`. Tests use in-memory PGlite (`pglite://:memory:`) and must not open the Neon URL.

## What you must click

Create the GitHub App. An agent cannot. Exact checklist: [README.md](../README.md) → “Create the GitHub App”.

Until those env vars exist, `/api/health` shows `githubApp: false` and sign-in returns 503.

## Do not start yet

Stripe, production Fly/Railway deploy, Resend, domain purchase, Electron/DMG isolated worker.
