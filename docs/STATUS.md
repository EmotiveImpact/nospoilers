# Status

Updated 4 September 2026. This is the honest answer to “is everything built?”

**No. The specified NoSpoilers product is in the repository. The commercial launch is not.**

Specified Watch, scanner, GitHub loop, billing enforcement, Release Ledger, Package Identity, and the internal Disclosure Desk are implemented and tested. Customers still cannot pay, cannot receive email, and do not have a production worker or `nospoilers.dev`. A few GitHub events are coded but not proven on a second account. Electron installers, SBOM, Sigstore verification, and scheduled CDN checks stay on ice.

The exhaustive row-by-row ledger is [`docs/expansion/FEATURE-INVENTORY.md`](expansion/FEATURE-INVENTORY.md). What to do next is [`docs/ROADMAP.md`](ROADMAP.md). How to run the repo is [`README.md`](../README.md).

## Read these, not twelve copies of the same list

| File | Job |
| --- | --- |
| **This file** | Built vs live vs leftover vs ice |
| [`docs/ROADMAP.md`](ROADMAP.md) | What is left, in order |
| [`docs/PRODUCT.md`](PRODUCT.md) | What we sell, pricing, invariants |
| [`CHANGELOG.md`](../CHANGELOG.md) | What shipped, dated |
| [`docs/HANDOFF.md`](HANDOFF.md) | Live host facts for the next agent |
| [`docs/ACCESS-BOUNDARIES.md`](ACCESS-BOUNDARIES.md) | Who may see or change what |
| [`docs/expansion/FEATURE-INVENTORY.md`](expansion/FEATURE-INVENTORY.md) | Every discussed feature, one row |
| [`docs/products/README.md`](products/README.md) | Module vs separate-app boundary |
| [`docs/ELECTRON.md`](ELECTRON.md) | Why installers are on ice |
| [`docs/MONTH1.md`](MONTH1.md) | Acquisition guess after a real launch |

Older pause notes live in [`docs/PLATFORM-PAUSE.md`](PLATFORM-PAUSE.md) as a pointer here. The expansion PRD and module PRDs are specifications, not a second status board.

## Customer product — built in this repo

These exist as routes, APIs, workers, and tests. Preview `/watch?as=trial` is the same desk with empty live data. No invented tenant rows.

| Area | What is in |
| --- | --- |
| Scanner / CLI / Action | Directories and packed artifacts (tgz, zip, asar, VSIX/CRX/XPI, wheel/sdist, JAR/WAR, NuGet, gem, Docker/OCI, APK/AAB/IPA, serverless zip). Nested unpack, never execute. JSON/SARIF. Fail-closed CI fixtures. |
| Watch desk | 2B monolith: Overview, Alerts, Sources, Releases, Timeline, Setup, Notifications, Policy, Team, Retention, Audit, Health, Tokens, Registries. Sidebar collapse. Live APIs. |
| GitHub coverage | OAuth, App install, HMAC webhooks, queue, worker, hourly visibility poller. Publicize, created-public, cheap `.env`/`.map` push, and fixture release scan are proven on the throwaway. |
| npm / websites | Public and private registry watch, prerelease channels, unpublish fact. HTTPS origin crawl after ownership proof. Sentry/Bugsnag map custody. Provider-neutral `/api/v1/deploy`. |
| Policy / receipts | `.nospoilers.yml`, allowlists, baselines, HMAC receipts, Release Diff, SIZE-003, hosted `POST /api/v1/scan`. |
| Release Ledger | Append-only revisions, on-demand delivery verify, approve/reject/hold, public `/verify/:token`, attestation refresh (no Sigstore verify), signing policy. |
| Package Identity | Protect owned names, snapshots, lookalikes, namespace watch, evidence/advisory page, risk score. Not a malware verdict. |
| Team / alerts | Roles, GitHub-login invites, Slack/SIEM/Jira/PagerDuty, routing, audit, 90-day timeline, retention window, incident ack/assign/resolve. |
| GitHub response | Make-private, delete latest pack assets, disable a non-NoSpoilers workflow — **409 until Administration, which we will not grant.** Setup and remediation PRs are reviewable and never merged. |
| Fair use | Concurrency and daily unpack caps. Counts, not a credit meter. |

## Internal product — built, owner-only

Artifact Leads and Disclosure Desk at `/internal/prospects`. Public GitHub/npm discovery, verification, templates, do-not-contact, reports, destinations. **Nothing is mailed. Nothing is auto-sent to maintainers.** Customer sessions stay 401.

## Wired in code, dark on this host

| Piece | Code | Live? |
| --- | --- | --- |
| Stripe Checkout, portal, lifecycle webhooks | Yes. 503 until keys and four price IDs | No. `/api/health` `stripe: false` |
| Resend Watch email | Yes. Destinations save; send 503 without keys | No. `resend: false`. Inbox stays GitHub-login only. Desk `sent` stays false |
| Vercel web/API | Yes | Temporary production alias exists |
| Railway worker | `railway.toml` + `NOSPOILERS_ROLE=worker` | Account/environment not deployed |
| `nospoilers.dev` | Documented | Not pointed |

Do not describe Stripe, email, or Railway as live because the UI or adapter exists.

## Coded, not loop-proven on GitHub

| Event | Code | Live proof |
| --- | --- | --- |
| Created public, cheap push, private → public, fixture `release_scan` | Yes | `EmotiveImpact/nospoilers-throwaway` |
| App-generated setup PR | Yes | https://github.com/EmotiveImpact/nospoilers-throwaway/pull/1 — leave open, never merge |
| Transfer, collaborator added, fork | Worker writes alerts | Needs a second GitHub account. Do not transfer the product repo. Do not invent `-vis` |
| Package Identity on a pack this install owns | Yes | No EmotiveImpact-owned npm package to protect |
| Hosted Checks write | Posts when granted | Not requested on the live App |
| Watch one-click containment | Typed confirm | 409 until Administration — do not grant it |

## On ice (do not start)

- Isolated Electron DMG / EXE / MSI / AppImage worker. The normal worker **skips** those assets and alerts. See [`docs/ELECTRON.md`](ELECTRON.md).
- CycloneDX/SPDX SBOM attachment.
- Sigstore / cosign / SLSA verification (adapters store presence only).
- Scheduled registry/CDN delivery polling (on-demand verify is built).
- SSO/SAML.
- Native Vercel / Netlify / Cloudflare account OAuth (generic deploy trigger is built).
- Anonymized aggregate research from Artifact Leads.

## Not this repository

| Item | Why |
| --- | --- |
| Employee Public Footprint | Separate future app. Different legal basis. PRD only. |
| Automatic malware verdict or takedown | Do not build. |
| Automated outreach or public naming | Do not build. |
| Scan-credit pricing | Locked no. |
| Public Enterprise tile | Not until a customer asks. |
| CLI DRM | Distribution, not the bill. |

## Watch chrome

The live desk is the 2B monolith against real APIs. Screen modules are extracted; `WatchPage.tsx` is orchestration only.

Visual chrome is still being tightened against Linear comps in `/mockup-review/`. Shot C (Linear view tokens on `.watch-stage` only, rail stays canvas black) is specified at [`/mockup-review/2b/21-stage-linear.html?shot=c`](../public/mockup-review/2b/21-stage-linear.html). Applying C to live Watch is a UI PR, not a product-capability gap.

## Launch bar

A public launch needs all of these. None of them are “write more product features.”

1. Stripe keys and four price IDs (human approval).
2. Resend keys and a from address (human approval). Do not mail disclosures.
3. Deploy the Railway worker with the same `DATABASE_URL` and GitHub secrets.
4. Point `nospoilers.dev` at Vercel. Cloudflare DNS is optional.
5. Production GitHub App webhook URL on that domain.

Until then: trial desk and Scan work; hosted coverage is real on the throwaway; nobody can be charged or emailed.
