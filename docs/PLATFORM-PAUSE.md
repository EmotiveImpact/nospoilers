# Platform build — paused here

Updated 2 September 2026 after the pre-design platform PRs landed on `main`. Resume the complete-platform job from this file after Watch desk 2B.

## Is it on `main`?

**Yes, through Milestone 4 process split.** `origin/main` is `59e00c6` (“Merge pull request #8 … production-runtime”).

| Phase | How it landed | On `main`? |
| --- | --- | --- |
| Stripe Checkout / portal / webhooks (dark, no keys) | https://github.com/EmotiveImpact/nospoilers/pull/6 merged | Yes |
| Resend Watch email destinations (dark, no keys) | https://github.com/EmotiveImpact/nospoilers/pull/7 commits merged via `9859d72`, PR closed (stacked base was not `main`) | Yes |
| Production serve + `NOSPOILERS_ROLE` + NOTIFY wake | https://github.com/EmotiveImpact/nospoilers/pull/8 commits merged via `59e00c6`, PR closed (stacked base was not `main`) | Yes |

Still **not** on `main`: Watch desk mockups (`cursor/watch-desk-ux-mockups-71d1`, PR #3) and the earlier 2B attempt (`cursor/watch-desk-2b-71d1`, PR #9). Ignore that 2B UI.

## Last place in the platform job

1. Phase 0 Neon runtime — **done** on live `neondb` (Auth off, event-driven wake, not 500 ms polling).
2. GitHub App loop on `EmotiveImpact/nospoilers-throwaway` — **done** for created-public, cheap `.env`/`.map` push, and fixture `release_scan`. Still **unproven live**: publicize, transfer, collaborator, fork.
3. Milestone 2 unpaid enforcement — **done**.
4. Milestone 3 Stripe — **on `main`, wired, not live**. This host has no Stripe keys. `/api/health` `stripe: false`.
5. Resend Watch email — **on `main`, wired, not live**. Migration `060` on Neon; destinations 0; `/api/health` `resend: false`. Disclosure Desk `sent` stays false. Invites stay GitHub-login only.
6. Milestone 4 process split — **on `main`**. `npm run build` + `npm run host` serves the SPA. `NOSPOILERS_ROLE=web|worker|all`. Enqueue `NOTIFY nospoilers_jobs`. Live health: `role: all`, `ui: true` after build, Neon. **Not deployed. No Railway account. No domain.**

Electron installer worker, SBOM, Sigstore, and scheduled CDN stay **on ice**. Employee Public Footprint stays **out of this repo**.

## What the human still has to do

- Stripe keys + four price IDs if you want charges (approval).
- Resend keys + from address if you want mail (approval). Do not mail disclosures.
- Railway + `nospoilers.dev` / Cloudflare DNS if you want a real public host (purchase). The `trycloudflare.com` URL is only a webhook tunnel. It is **not** the database.
- GitHub App **Pull requests: write**, then Accept on the install, for a live setup PR. Do **not** grant Administration or Workflows write.
- Optional: `GITHUB_PROOF_TOKEN` on the throwaway only, for publicize / collaborator proofs.

## Resume the platform job

Read `docs/PRODUCT.md`, Ultimate PRD, FEATURE-INVENTORY, ROADMAP, HANDOFF, ACCESS-BOUNDARIES, and this file. Continue from current `main`. Do not treat Watch desk 2B as Stripe/Resend/Railway being live.
