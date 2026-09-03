# Platform build — paused here

Updated 3 September 2026 after Watch desk 2B landed on the live signed-in `/watch` shell. Resume the complete-platform job from this file. Stripe/Resend/Railway are still not live.

## Is it on `main`?

**Yes, through Milestone 4 process split, visibility proofs including live publicize, the PR #2 home hero, attestation adapters, and signing policies.** Check `origin/main` for the current tip.

| Phase | How it landed | On `main`? |
| --- | --- | --- |
| Neon runtime (PR #1 leftover) | Already on `main` via later commits. GitHub PR #1 is a stale draft on an old branch | Yes (code). PR closed leftover |
| Home hero (PR #2) | Two-column hero + CLI/hosted cards landed on `main`; Log in kept | Yes |
| Stripe Checkout / portal / webhooks (dark, no keys) | https://github.com/EmotiveImpact/nospoilers/pull/6 merged | Yes |
| Resend Watch email destinations (dark, no keys) | https://github.com/EmotiveImpact/nospoilers/pull/7 commits merged via `9859d72`, PR closed (stacked base was not `main`) | Yes |
| Production serve + `NOSPOILERS_ROLE` + NOTIFY wake | https://github.com/EmotiveImpact/nospoilers/pull/8 commits merged via `59e00c6`, PR closed (stacked base was not `main`) | Yes |
| GitHub / public-npm attestation adapters | Fetch attestation documents for a sealed digest; store presence/subject/builder; no Sigstore verify | Yes. Live Neon `061` on throwaway `phase1-fixture` revision 6 |
| Customer-managed signing policies | One install policy; require GitHub/npm present or builder prefix before approve-to-ship; no Sigstore verify | Yes. Live Neon `062`; leftover policies 0 |
| Live publicize proof | Private → public on the existing throwaway; jobs 52/53 → alerts 41/42 | Yes. Do not invent `-vis` |
| Live App-generated setup PR | https://github.com/EmotiveImpact/nospoilers-throwaway/pull/1 from `nospoilers/setup`; Action only; never merge | Yes. Recorded on `main`. Do not merge |

Watch desk 2B is the live signed-in desk. Leftover mockup PR #3 and earlier 2B PR #9 stay ignored as product branches.

## Last place in the platform job

1. Phase 0 Neon runtime — **done** on live `neondb` (Auth off, event-driven wake, not 500 ms polling). `LISTEN nospoilers_jobs` reconnects when Neon drops the idle socket so the origin does not die.
2. GitHub App loop on `EmotiveImpact/nospoilers-throwaway` — **done** for created-public, cheap `.env`/`.map` push, fixture `release_scan`, **private → public**, and the **App-generated setup PR**. Cheap-push **re-proven**: job **51** `done` → alert **40**. Publicize **proven** 3 Sep 2026: jobs **52** and **53** `done` → alerts **41** and **42**. Setup PR **proven** 3 Sep 2026: https://github.com/EmotiveImpact/nospoilers-throwaway/pull/1 (`nospoilers-dev[bot]`, `nospoilers/setup` → `main`, open, never merged; Action only). Still **unproven live**: transfer, collaborator, fork. Do not transfer. Do not merge that setup PR. Do not grant App Administration. Do not invent `-vis`.
3. Milestone 2 unpaid enforcement — **done**.
4. Milestone 3 Stripe — **on `main`, wired, not live**. This host has no Stripe keys. `/api/health` `stripe: false`.
5. Resend Watch email — **on `main`, wired, not live**. Migration `060` on Neon; destinations 0; `/api/health` `resend: false`. Disclosure Desk `sent` stays false. Invites stay GitHub-login only.
6. Milestone 4 process split — **on `main`**. `npm run build` + `npm run host` serves the SPA. `NOSPOILERS_ROLE=web|worker|all`. Enqueue `NOTIFY nospoilers_jobs`. Live health: `role: all`, `ui: true` after build, Neon. **Not deployed. No Railway account. No domain.**
7. npm/GitHub attestation adapters — **on `main`**. Live Neon: `061` applied; throwaway `phase1-fixture` revision 6 stored github `missing` with no alert; leftover row stayed. Sigstore verify stays Planned.
8. Customer-managed signing policies — **on `main`**. Live Neon: `062` applied; unauth PUT 401; GET `{ policy: null }`; PUT require-github 200 on install `158159401`; GET returned the policy; DELETE leftover 0; `watched_packages` 0. Approve-to-ship 409 is unit-tested; live throwaway revision 6 is `failed-policy` so approve 409s dirty first. Sigstore verify stays Planned.
9. Remaining specified work is **human-gated or on ice**: Stripe/Resend keys, Railway + `nospoilers.dev`, a second GitHub account for collaborator/fork proof, an EmotiveImpact-owned npm pack for live Package Identity, Electron / SBOM / Sigstore verify / scheduled CDN (ice). Watch desk 2B is the live signed-in UI. The live setup PR is open and must stay unmerged. Do not transfer. Do not grant Administration or Workflows write. Client projects, other registries, aggregate research, and Employee Public Footprint stay out.

Electron installer worker, SBOM, Sigstore, and scheduled CDN stay **on ice**. Employee Public Footprint stays **out of this repo**.

## What the human still has to do

- Stripe keys + four price IDs if you want charges (approval).
- Resend keys + from address if you want mail (approval). Do not mail disclosures.
- Railway + `nospoilers.dev` / Cloudflare DNS if you want a real public host (purchase). The `trycloudflare.com` URL is only a webhook tunnel. It is **not** the database.
- Leave https://github.com/EmotiveImpact/nospoilers-throwaway/pull/1 **open**. Do not merge it. Workflow YAML stays copy-paste. Do **not** grant Administration or Workflows write.
- Optional: `GITHUB_PROOF_TOKEN` on `EmotiveImpact/nospoilers-throwaway` only (Administration + Contents write) if you want the script to flip visibility. The live proof used GitHub Settings → Private, then Public with `npm run dev` running. Do not invent `-vis`. Do not grant the App Administration.

## Resume the platform job

Read `docs/PRODUCT.md`, Ultimate PRD, FEATURE-INVENTORY, ROADMAP, HANDOFF, ACCESS-BOUNDARIES, and this file. Continue from current `main`. Watch desk 2B is the live signed-in UI. Do not treat that as Stripe/Resend/Railway being live.
