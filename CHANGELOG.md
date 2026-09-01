# Changelog

## Unreleased

- Point the hosted app at Neon (project NoSpoilers, branch production, database neondb) via `DATABASE_URL`.
- `/api/health` reports database driver/host/name and worker intervals without secrets.
- Apply schema statements one at a time so Neon’s pooler can run idempotent migrations.
- Tests: API enqueue wakes the worker; recovery timer is 15 minutes, not 500ms; visibility poller is hourly.
- Allow `*.trycloudflare.com` on the Vite server so a Cloud Agent tunnel can serve GitHub OAuth and webhooks. `127.0.0.1` is not a GitHub-reachable address.

## 0.1.0

- Scanner kernel (tarball, zip, asar), CLI, GitHub Action, local drop-zone UI.
- Hosted GitHub App loop: webhooks, Postgres queue, worker, visibility poller, log notifier.
- Event-driven queue pickup (wake on enqueue; 15-minute crash recovery).
- Internal Artifact Leads desk for public packs only.
- Coverage states: 14-day trial, Solo/Team plans (billing not wired).
