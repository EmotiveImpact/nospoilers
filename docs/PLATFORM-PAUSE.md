# Platform build — paused here

Written 2 September 2026 so the complete-platform job can resume after Watch desk 2B.

## Is it on `main`?

**No.** `origin/main` is `44c192f` (“Keep website crawls off the daily unpack enqueue path.”).

These later phases are **only on stacked branches / draft PRs**, not merged:

| Phase | Branch | Draft PR | On `main`? |
| --- | --- | --- | --- |
| Stripe Checkout / portal / webhooks (dark, no keys) | `cursor/stripe-checkout-1479` | https://github.com/EmotiveImpact/nospoilers/pull/6 | No |
| Resend Watch email destinations (dark, no keys) | `cursor/resend-email-1479` | https://github.com/EmotiveImpact/nospoilers/pull/7 | No |
| Production serve + `NOSPOILERS_ROLE` + NOTIFY wake | `cursor/production-runtime-1479` | https://github.com/EmotiveImpact/nospoilers/pull/8 | No |

Stack: `main` → Stripe → Resend → production-runtime.

Watch desk mockups live on `cursor/watch-desk-ux-mockups-71d1` (PR #3). An earlier 2B attempt (`cursor/watch-desk-2b-71d1`, PR #9) only added routes and left the old stacked panels — ignore that UI.

## Last place in the platform job

1. Phase 0 Neon runtime — **done** on live `neondb` (Auth off, event-driven wake, not 500 ms polling).
2. GitHub App loop on `EmotiveImpact/nospoilers-throwaway` — **done** for created-public, cheap `.env`/`.map` push, and fixture `release_scan`. Still **unproven live**: publicize, transfer, collaborator, fork.
3. Milestone 2 unpaid enforcement — **done**.
4. Milestone 3 Stripe — **wired, not live**. This host has no Stripe keys. `/api/health` `stripe: false`.
5. Resend Watch email — **wired, not live**. Migration `060` on Neon; destinations 0; `/api/health` `resend: false`. Disclosure Desk `sent` stays false. Invites stay GitHub-login only.
6. Milestone 4 process split — **in code on the production-runtime branch**. `npm run build` + `npm run host` serves the SPA. `NOSPOILERS_ROLE=web|worker|all`. Enqueue `NOTIFY nospoilers_jobs`. Live health on that branch: `role: all`, `ui: true` after build, Neon. **Not deployed. No Railway account. No domain.**

Electron installer worker, SBOM, Sigstore, and scheduled CDN stay **on ice**. Employee Public Footprint stays **out of this repo**.

## What the human still has to do

- Decide whether to merge or close PRs #6–#8 (or replay those commits onto `main`).
- Stripe keys + four price IDs if you want charges (approval).
- Resend keys + from address if you want mail (approval). Do not mail disclosures.
- Railway + `nospoilers.dev` / Cloudflare DNS if you want a real public host (purchase). The `trycloudflare.com` URL is only a webhook tunnel. It is **not** the database.
- GitHub App **Pull requests: write**, then Accept on the install, for a live setup PR. Do **not** grant Administration or Workflows write.
- Optional: `GITHUB_PROOF_TOKEN` on the throwaway only, for publicize / collaborator proofs.

## Resume the platform job

Read `docs/PRODUCT.md`, Ultimate PRD, FEATURE-INVENTORY, ROADMAP, HANDOFF, ACCESS-BOUNDARIES, and this file. Continue from the stacked branches above, or cherry-pick onto `main` first. Do not treat Watch desk 2B as Stripe/Resend/Railway being live.
