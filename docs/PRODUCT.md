# NoSpoilers — product bible

This file is the source of truth for what we sell and why. Chat can run out of context. **Read this before changing product, pricing, or hosted architecture.**

What is actually built vs live is [`docs/STATUS.md`](STATUS.md). What is left is [`docs/ROADMAP.md`](ROADMAP.md). Every discussed feature is [`docs/expansion/FEATURE-INVENTORY.md`](expansion/FEATURE-INVENTORY.md). Module PRDs live under `docs/products/`.

Tagline: **no spoilers in production.**
Category: **release exposure protection** — final-artifact and production-web inspection plus
GitHub exposure monitoring.

Owner: Creative Director (Emotive Impact). GitHub login: `EmotiveImpact`.

---

## What this product is

NoSpoilers watches three doors so source maps, secrets, and “this was private” surprises do not ship:

1. **Packed bytes** — the npm tarball, zip, VSIX, wheel, JAR, gem, Docker/OCI image, APK/IPA, serverless zip, or Electron `app.asar` about to go to customers. Same class of leak as Claude Code’s `cli.js.map` on npm and source maps inside a public desktop installer.
2. **GitHub visibility** — private → public, created public, transfer, collaborator added, fork.
3. **Deployed web assets** — the HTTPS page customers load, plus same-origin JavaScript, CSS, maps, and a bounded probe of exposed files, credentials, and internal paths. Scripts are not executed.

Same brand, same scanner kernel, same alerts. Not a GitGlow clone (visibility email only). GitGlow is free (~138 installs). Visibility-only is a weak v1.

GitHub secret scanning does **not** catch packed maps. Making the git repo private does **not** catch an installer on a CDN.

These are different evidence sources, not different scanners. CLI/CI and Scan inspect pre-release
bytes; GitHub Release and npm monitoring inspect published packs; Production Sources crawls the
deployed website. All use the same deterministic rules, limits, policy, receipt, and finding model.
When a source map embeds `sourcesContent`, the scanner reconstructs bounded virtual source files in
memory so a finding identifies the original source path. Reconstructed source and credential values
are never persisted or logged.

Production Web requires proof that the install controls the hostname before deployment-triggered
scans. DNS TXT and HTTPS well-known-file verification are supported. A verified admin can mint a
hashed deployment token for one provider-neutral endpoint; Vercel, Netlify, Cloudflare, or an
existing CI pipeline can call the same endpoint with an idempotent deployment ID. Provider-native
OAuth installations remain convenience work after customer demand, not separate scanners.

---

## What is already built (this repo)

The specified customer product is in the repository: Watch, scanner, GitHub loop, unpaid-install
kill, Release Ledger, Package Identity, notifications, and the owner-only Disclosure Desk. See
[`docs/STATUS.md`](STATUS.md) for the honest live/dark split.

| Piece | Where |
| --- | --- |
| Scanner kernel | `src/scanner/` — dir, `.tgz`/`.tar.gz`, `.zip`, `.vsix`, `.crx`, `.xpi`, Chrome extension ZIP, `.whl`, Python sdist (PKG-INFO), `.jar`/`.war`, `.nupkg`, `.gem`, Docker/OCI image tar, `.apk`/`.aab`/`.ipa`, serverless zip, Electron `.asar`; bounded in-memory source-map reconstruction; npm/pnpm/Yarn/Bun workspace listing |
| CLI | `src/cli.ts` — `npx tsx src/cli.ts scan <path> [--strict] [--json] [--sarif file]` |
| GitHub Action | `action.yml` (this repo, `uses: ./`). Customer Setup PR vendors `.github/actions/nospoilers`, which POSTs packed bytes to `/api/v1/scan`. |
| Watch / Scan UI | Vite + React + Tailwind. Port **4347**. Hosted `POST /api/v1/scan` with a hashed install token. |
| Fixtures | `fixtures/` + `scripts/build-fixtures.ts` |
| Tests | `tests/` — scanner, fixtures, hosted, Watch architecture |

**Rules:** MAP-001/002/003, SEC-001/002/003/004, AI-001, NET-001, DBG-001, CRASH-001,
GIT-001, SRC-001, SIZE-001/002/003. Credential values never appear in reports.

**Scanner safety:** default hard limits are 80 MiB input, 500 MiB unpacked, 25,000 files,
25 MiB per file, and 90 seconds. `.dmg`, `.exe`, `.msi`, and `.AppImage` are skipped on the
normal worker; the isolated installer job stays on ice. See `docs/ELECTRON.md`.

**Exit codes:** 0 clean, 1 failed-policy, 2 error or inconclusive (never a passing receipt).

**Not live:** Stripe keys, Resend keys, Railway worker deploy, `nospoilers.dev`. Adapters and the
process split (`NOSPOILERS_ROLE=web|worker`) are in code. Vercel serves web/API on a temporary
alias. Marketplace is optional after ~100 installs.

---

## Two products people mix up

| Thing | Can a free/pirated CLI do it? | Do we get paid? |
| --- | --- | --- |
| Scan a file on their laptop / in CI | Yes | Only if we charge for the CLI — and even then a cracked CLI exists |
| Watch GitHub (publicize, releases, collaborators) | **No.** The CLI is not logged into GitHub and does not sit waiting | This is the hosted product. This is the bill |

“Put it in their build” = add a CI step like `npx nospoilers scan ./dist/app.asar`. If that command is unlimited and free, a team can never visit the site and never pay. That is a **distribution idea**, not a law.

Any CLI that runs on their machine **can be copied or have a license check ripped out**. Same as pirating Photoshop. Do not spend months on DRM.

- Honest companies will not ship a cracked binary in GitHub Actions.
- Pirates were not going to pay.
- **Kill unpaid hosted installs** (see below) is the switch that actually works.

---

## What “kill unpaid hosted installs” means

The **hosted** product is our servers + their GitHub App installation.

When their trial ends and they have not paid (or they cancel):

1. Stop processing their webhooks (or keep 200 OK so GitHub is happy, but do not scan/alert).
2. Stop the poller for that install.
3. Dashboard: “subscribe to keep watching.”
4. Optionally uninstall / suspend the GitHub App installation via API, or leave it installed but inert.

They cannot pirate that. The bot only thinks if **we** allow that installation ID.

The **CLI** is separate. We do not “kill” a file on their laptop. Treat CLI as a bonus with a paid plan (speed bump: `NOSPOILERS_LICENSE`), not a vault.

---

## Pricing (locked unless we explicitly change this)

They pay a **monthly subscription for coverage**, not scan credits. Credits train people to turn it off.

| | **Solo — $29 / month** | **Team — $99 / month** |
| --- | --- | --- |
| Who | One person, their GitHub user or one org they own | A company org |
| Repos | All repos they grant the App | All repos in that install |
| Visibility alerts | Unlimited | Unlimited |
| Pack scans | Included, fair use (not a credit counter in the UI) | Included, higher fair use |
| CLI | Included with the plan | Included |
| Extra | Email + configurable retention | Slack + Jira + routing + 90-day timeline + roles + audit export + identity signals + release approval / legal hold / ledger export + configurable retention |

- **14-day full trial**, then the card bills.
- Yearly: 10 months for the price of 12 (~$290 / ~$990).
- No “3 free repos forever.” No GitHub Marketplace as the only checkout (Stripe on our site). Marketplace cut is 5% if we list later; Stripe is ~2.9% + $0.30 (+ billing %).
- Fair use in the terms; unlimited-**feeling** in the UI. Cap **concurrency** (how many unpacks at once), not a “47 of 500 scans left” meter.
- If abuse: queue them, email, offer Team / high-volume. Do not surprise-charge $400.
- No public Enterprise tile until a real company asks.

---

## GitHub API quota (plain language)

GitHub only answers so many questions per hour from the bot. After that: HTTP **429**, wait.

- Typical GitHub App install: about **5,000 requests/hour** (more on large orgs / Enterprise Cloud, up to ~12,500 / 15,000).
- **$0.** It is a speed limit, not a bill.
- Quota is **per customer install**, not one bucket for all of NoSpoilers. Acme hitting 429 does not stop Globex.
- Heavy scans (list files, download release) use many requests. Light “did this go public?” uses few.
- That is why we **queue** and **cap** concurrent unpacks.

GitHub webhooks: answer **HTTP 200 in ~10 seconds** or the delivery can **fail and not retry reliably**. Never unpack inside the webhook request.

---

## Scale (plain language)

**10–100 customers on one small box** is a guess, not a product cap. It means “one cheap computer can babysit that many quiet installs.” Work matters, not logo count.

| Load | What they see |
| --- | --- |
| Normal | Alert in seconds to a minute |
| Busy | Visibility still fast. Installer scans may wait minutes |
| Spike | Dashboard “queued.” Doorbell still 200. Nothing silently dropped |

How we grow (same app, more cooks):

1. Queue in Postgres. One machine.
2. Filter: do **not** full-unpack on every push. Unpack on **release** / **publicize** / obvious pack files.
3. More **worker** machines when the list is long. Heavy unpack cap **2–8** global (and per noisy customer so they cannot starve others). Light jobs 20–50 concurrent.
4. Bigger Neon / Resend plan.
5. Google Cloud (Cloud Run + Cloud Tasks) **later** — enterprise questionnaires and true HTTP burst, not day one.

Autoscaling = more cooks pulling from the same ticket rail. Not 1,000 machines for 1,000 jobs.

---

## Architecture (holy invariants)

```
Customer browser  →  dashboard (login, alerts; billing later)
GitHub  --webhook POST-->  API (always on)
                           verify HMAC → INSERT job → 200 OK (<1s)
Postgres: users, installations, repos, jobs, alerts
Workers: light (visibility) vs heavy (download+unpack, cap 2–8)
         existing src/scanner kernel
         do not store customer source — findings rows only
Notifier port: logs + alerts table; Resend Watch email when keys exist; log adapter stays the fallback
Hourly poller: re-check visibility if a webhook was missed
```

Invariants:

1. Webhook does no unpack, clone, or email wait.
2. Do not store customer source long-term.
3. Idempotent on GitHub `delivery_id`.
4. Two priorities so fat scans never block “repo went public.”
5. Cloud spend cap so a retry bug cannot run overnight.
6. Secrets (PEM, webhook secret, Stripe, Resend) never in git.

Queue pickup is event-driven inside the API process: a successful enqueue wakes the worker
immediately. A 15-minute timer is recovery only. Do not return to sub-second empty-queue polling;
it keeps serverless Postgres awake without improving webhook latency.

**v1 ops:** Vercel web/API + Railway worker + Neon Postgres + registrar DNS + Stripe + GitHub App + Resend. Queue **inside Postgres** first. Not Inngest ($99) until revenue. Not Vercel/Cloudflare Workers for unpack. Not GCP/AWS day one.

**Do not buy domain / Railway / Resend / Stripe until a human approves.** The throwaway loop already works.

---

## GitHub App (plain language)

Not an iPhone app. Not GitHub Actions YAML. A **robot identity** registered with GitHub:

- Customer clicks **Install**, picks repos.
- GitHub POSTs events to **our** URL.
- We talk back with a short-lived installation token (JWT from our `.pem`).
- Survives the human who installed it leaving the company.
- Fine-grained permissions. One webhook for the whole install.

Creating the App is **$0**. User creates it in GitHub → Settings → Developer settings → GitHub Apps. Agent cannot click that; README must be an exact checklist.

Actions stay as optional fail-closed CI. OAuth is only “log into the website.”

---

## Infra prices (order of magnitude, 2026 list)

| Piece | Day-1 |
| --- | --- |
| Fly small always-on box | ~$7–20 / mo |
| Railway always-on 1 CPU / 1 GB | often ~$30 / mo (Hobby $5 / Pro $20 is a **floor**, not a cap) |
| Neon Postgres | free → ~$5–25 Launch |
| Resend | free 3,000/mo (100/day); $20 for 50k |
| Stripe | no monthly; ~2.9% + $0.30 per US charge |
| Domain nospoilers.dev | ~$10–15 / year (available last we checked; `.com`/`.app`/`.io` taken) |
| GitHub App | $0 |
| Fly Managed Postgres | $38+ — **skip**, use Neon |
| Inngest Pro | $99 — **skip** for v1 |
| GCP Cloud SQL | often $50–150 idle — **later** |

Two paying Solo customers at $29 cover a ~$50 infra bill.

Railway Hobby max **6** replicas, Pro **42**. Fly more flexible; org may cap machines until you ask.

---

## Phases — current

### Phase A — hosted loop — done

Throwaway install → webhook 200 → queue → Watch alert → fixture release scan. Proven on
`EmotiveImpact/nospoilers-throwaway`. Slack, Team routing, fair-use caps, and one-click GitHub
responses (409 without Administration) are already in the product. They are not “Phase C ideas.”

### Phase B — go live — human-gated

Adapters are written. Keys and accounts are not.

| Piece | Why it is still waiting |
| --- | --- |
| **Domain** (`nospoilers.dev`) | Public URL and email DNS. GitHub can already hit a tunnel or the Vercel alias. |
| **Railway worker** | Always-on job consumer. Vercel is web/API. Code split exists. |
| **Resend** | Real email. Needs a domain and keys. Until then, Watch + logs. |
| **Stripe** | Take money after the loop is real. This host has no keys. |

### Phase C — later / ice

Marketplace listing, CLI license bump, isolated Electron worker, SBOM, Sigstore verify, scheduled
CDN, native cloud-account deploy adapters, GCP if a contract demands it. See [`docs/ROADMAP.md`](ROADMAP.md).

---

## Naming

**NoSpoilers.** Domain **nospoilers.dev** (~$10/yr) — not purchased at time of writing. npm `nospoilers` was free; `no-spoilers` is an unrelated tiny web component. Dormant GitHub user `nospoilers` (2012).

Rejected: RepoRadar, Hatchdoor, RepoLarm, Leakwake, LeakRadar.

---

## Archival goal prompts

Phase A is done. Phase B is keys and deploy, not a greenfield build. The prompts below are
historical. Use [`docs/STATUS.md`](STATUS.md) and [`docs/HANDOFF.md`](HANDOFF.md) instead.

### Goal prompt for Phase A (paste to an agent)

```
Build NoSpoilers hosted v1 in this repo. Read docs/PRODUCT.md first. Do not buy a domain, Fly, Railway, Resend, or Stripe. Do not add Google Cloud. Do not rewrite the existing scanner.

## Already in the repo — reuse it
- Scanner kernel: src/scanner/ (dir, tgz, zip, vsix, crx, xpi, whl, jar, nupkg, gem, docker/oci, apk/aab/ipa, serverless zip, asar; MAP-*, SEC-*, GIT-*, SRC-*, SIZE-*)
- CLI: src/cli.ts  |  Action: action.yml  |  Local drop-zone UI: Vite + src/plugin.ts
- Keep CLI + Action working. Keep npm run dev for local pack drop-zone or fold it into the new app without dropping that path.

## What “done” means (the product loop)
A person can:
1. Open the web app, sign in with GitHub (GitHub App user auth).
2. Install the NoSpoilers GitHub App on a user or org, all repos or selected repos.
3. See installed repos in the dashboard (name, private/public, last check).
4. When a watched repo is publicized, created public, or transferred, an alert appears in the dashboard within ~1 minute. Same for collaborator added / fork if those events are subscribed.
5. When a release is published, download the release asset(s) that are packed artifacts (.tgz/.tar.gz/.tar/.zip/.asar/.vsix/.crx/.xpi/.whl/.jar/.war/.nupkg/.gem/.apk/.aab/.ipa/.lambda.zip) (skip huge/irrelevant files with a size cap), run the EXISTING scanner, show findings. Never keep the unpacked bytes after the scan — store finding rows only.
6. Empty, loading, and error states on every screen. Real copy. Desktop + mobile.
7. Webhook handler: verify HMAC, insert job, HTTP 200 in under 1 second. NO scan/clone/email in the request.
8. Postgres job queue with SKIP LOCKED. Two priorities: light (visibility/member/fork) high concurrency; heavy (download+unpack) cap 2–8 concurrent globally. Idempotent on GitHub delivery_id.
9. Hourly poller: for each installation, re-check visibility so a missed webhook still alerts.
10. Notifier port: AlertNotifier.send(). Default adapter writes to server logs + the alerts table. No Resend until we have a domain.

## Stack
- Keep TypeScript. Hosted app can stay Vite UI + Node, or Next.js in this repo — pick one and don’t add a second framework.
- Postgres locally (Docker or embedded) with migrations. Schema: installations, repos, jobs, alerts, users. No long-term customer source.
- GitHub App (not PAT-only, not OAuth-app-only). Installation tokens via the App private key. Least permissions that still get visibility + release assets + contents read.
- Public webhook reachability via smee.io or cloudflared (document exact commands). Uncommon port, not 3000/5173/8080. Leave the server running.
- Env: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, DATABASE_URL, APP_BASE_URL. .env.example. README: user creates the GitHub App in GitHub Developer settings (name NoSpoilers, permissions, events, webhook URL + secret) and pastes ids/keys. Agent cannot click that for them — checklist must be exact.

## Explicitly out of scope
Stripe, billing, license keys, Slack, auto make-private, Marketplace listing, npm publish, custom domain, production Fly/Railway deploy, storing artifacts, scanning all-of-github, cloning the full git tree on every push.

## Push hygiene
On every push: path-filter cheap checks for *.map / .env; do NOT full-unpack the git tree. Full unpack only on release assets (and optional manual “scan this repo’s latest release” button).

## Quality
- Tests for: webhook HMAC reject, 200-without-scan, job idempotency, light vs heavy concurrency cap, scanner still passing existing fixture tests, visibility poller creates an alert when a repo flips public (GitHub API mocked only at the HTTP boundary — no fake scan results).
- README: what this is, how to run locally, how to create the GitHub App, how to install on a throwaway repo and prove publicize → alert.
- Commit and push on the current branch. No PR unless asked.

Begin by mapping src/scanner into the worker. Ship the loop above as one usable slice, not a platform scaffold.
```

---

### Goal prompt for Phase B (only after throwaway-repo proof)

```
NoSpoilers Phase B go-live. Read docs/PRODUCT.md. Phase A loop already works.

- Buy/configure nospoilers.dev DNS (Cloudflare).
- Deploy API + workers to Fly.io (uncommon port; always-on web process; worker process; spend cap). Neon for Postgres.
- Plug Resend into AlertNotifier (keep log adapter as fallback). Done in code; live only when `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set. Do not mail Disclosure Desk or invites.
- Stripe: 14-day trial, Solo $29, Team $99, yearly 10-for-12. After trial/cancel, kill unpaid hosted installs (stop jobs/alerts; dashboard paywall). Do not DRM the CLI.
- Production GitHub App webhook URL on the real domain.
- Do not add Slack, Marketplace, GCP, or make-private unless already specified.
```
