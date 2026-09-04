# Next-agent handoff

Read **[`docs/STATUS.md`](STATUS.md)** first. Then [`docs/PRODUCT.md`](PRODUCT.md), [`docs/ROADMAP.md`](ROADMAP.md), and [`docs/ACCESS-BOUNDARIES.md`](ACCESS-BOUNDARIES.md). Do not treat this file as a second feature list.

## Repository

- Private GitHub: `EmotiveImpact/nospoilers`
- Default branch: `main`
- Local app: `npm run dev` → **http://127.0.0.1:4347** (not 3000)
- Watch is the 2B monolith against live APIs. Ember is homepage-only. Do not invent customer rows.
- Preview: `/watch?as=trial`, `/watch?as=ended`, `/scan?as=ended`

## Database

- Neon project `NoSpoilers`, branch `production`, database `neondb`. Neon Auth stays off.
- App boots from `DATABASE_URL` (Runtime Secret + gitignored `.env`). Without it, local PGlite under `data/`.
- `/api/health` reports `{ database: { mode: "neon" | "postgres" | "pglite" } }` and never the URL.
- Next unused migration id is **`063_*`**. Applied through `062_release_signing_policies`.
- Receipts are HMAC `dev-hmac` in development. Production signing should move to KMS.
- Tokens and webhook/Jira/PagerDuty/Slack/SIEM/email secrets are AES-GCM (`ns1.`). Never returned after save.
- Scan API tokens are SHA-256 hashes (`nsp_` shown once). Deploy tokens are `nsd_` hashes.

## Live GitHub facts

- App: `nospoilers-dev`. Install **`158159401`** on `EmotiveImpact` (all repos).
- Contents write and Pull requests write are accepted. Members read is requested, not accepted. Checks write is not requested. **Administration is not granted. Do not grant it. Do not request Workflows write.**
- Throwaway: `EmotiveImpact/nospoilers-throwaway` (repo `1353409756`). Proven: created-public, cheap `.env`/`.map` push, private → public (jobs 52/53 → alerts 41/42), fixture `release_scan` (`phase1-fixture`, failed-policy MAP-001/002/003).
- Setup PR (leave open, never merge): https://github.com/EmotiveImpact/nospoilers-throwaway/pull/1
- Scripts: `npm run phase1:throwaway`, `phase1:visibility`, `phase1:setup-pr`. Do not invent `-vis`. Do not publicize a product repository. Do not transfer.
- Optional `GITHUB_PROOF_TOKEN` only on that disposable repo. The product-repo user token 403s writing the throwaway.

## This host

| Flag | Value |
| --- | --- |
| Stripe | Wired. No keys. `stripe: false`. Checkout 503 |
| Resend | Wired. No keys. `resend: false`. Send 503. Do not mail disclosures or invites |
| Process | `NOSPOILERS_ROLE=web\|worker\|all`. Enqueue `NOTIFY`s `nospoilers_jobs`. LISTEN reconnects. Recovery 15 minutes |
| Railway | Defined, not deployed |
| Domain | `nospoilers.dev` not cut over |

`ADMIN_TOKEN` opens `/internal/prospects`. Create a new long random token; do not reuse a leaked one. `GITHUB_DISCOVERY_TOKEN` is optional.

## Do not

- Describe Stripe, Resend, or Railway as live.
- Grant App Administration or Workflows write.
- Merge the throwaway setup PR.
- Invent tenant data, `-vis` repos, or queue counts.
- Start Electron / SBOM / Sigstore verify / scheduled CDN.
- Build Employee Public Footprint in this repository.
- Buy Stripe, Resend, Railway, or DNS without approval.

## Next prompt

```text
Read docs/STATUS.md, docs/PRODUCT.md, docs/ROADMAP.md, docs/HANDOFF.md,
and docs/ACCESS-BOUNDARIES.md.

Specified product code is in. Launch is Stripe keys, Resend keys, Railway,
and nospoilers.dev — all human-gated. Watch chrome follows shot C
(/mockup-review/2b/21-stage-linear.html?shot=c): treatment on .watch-stage
only, rail stays #09090b.

Do not grant Administration. Do not merge throwaway PR #1. Do not invent
-vis. Do not mail disclosures. Next migration is 063_*.
```
